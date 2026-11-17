import { randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { firstValueFrom } from 'rxjs';
import {
  childContext,
  DeliveryAssignedEvent,
  EventContext,
  formatTraceparent,
  OrderCancelledEvent,
  OrderConfirmedEvent,
  OrderPlacedEvent,
  OrderStatus,
  PaymentCompletedEvent,
  PaymentFailedEvent,
  PaymentRefundRequestedEvent,
  PricingServiceClient,
  RabbitClient,
  resolveOnManualCancel,
  resolveOnPaymentResult,
  resolveOnStockFailure,
  RoutingKey,
  StockReservationFailedEvent,
  TraceContext,
} from '@nexvia/shared';
import { CreateOrderDto, CancelOrderDto } from './dto';
import { Order } from './order.schema';

@Injectable()
export class OrdersService implements OnModuleInit {
  private pricing!: PricingServiceClient;

  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<Order>,
    @Inject('PRICING_PACKAGE') private readonly pricingClient: ClientGrpc,
    private readonly rabbit: RabbitClient,
  ) {}

  async onModuleInit() {
    this.pricing = this.pricingClient.getService<PricingServiceClient>('PricingService');
    await this.rabbit.consume(
      'orders.saga',
      [
        RoutingKey.PaymentCompleted,
        RoutingKey.PaymentFailed,
        RoutingKey.StockReservationFailed,
        RoutingKey.DeliveryAssigned,
      ],
      (event) => this.handleEvent(event),
    );
  }

  private baseEvent<T extends object>(order: Order, extra: T) {
    return {
      eventId: '',
      occurredAt: new Date().toISOString(),
      correlationId: order.correlationId,
      ...extra,
    };
  }

  async create(dto: CreateOrderDto, context: TraceContext) {
    const quote = await firstValueFrom(
      this.pricing.calculateQuote({
        restaurantId: dto.restaurantId,
        items: dto.items,
        traceparent: formatTraceparent(context),
      }),
    );
    if (quote.error) throw new BadRequestException(quote.error);

    const order = await this.orderModel.create({
      customerId: dto.customerId,
      restaurantId: dto.restaurantId,
      items: quote.lines,
      subtotal: quote.subtotal,
      deliveryFee: quote.deliveryFee,
      tax: quote.tax,
      totalAmount: quote.total,
      status: OrderStatus.PendingPayment,
      correlationId: randomUUID(),
    });

    const event: OrderPlacedEvent = this.baseEvent(order, {
      orderId: String(order._id),
      customerId: order.customerId,
      restaurantId: order.restaurantId,
      items: order.items,
      subtotal: order.subtotal,
      deliveryFee: order.deliveryFee,
      tax: order.tax,
      totalAmount: order.totalAmount,
    });
    await this.rabbit.publish(RoutingKey.OrderPlaced, event, childContext(context));
    return order;
  }

  async findById(id: string) {
    if (!isValidObjectId(id)) throw new NotFoundException('Order not found');
    const order = await this.orderModel.findById(id);
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async findAll(customerId?: string) {
    return this.orderModel.find(customerId ? { customerId } : {}).sort({ createdAt: -1 });
  }

  async cancel(id: string, dto: CancelOrderDto, context: TraceContext) {
    const order = await this.findById(id);
    const transition = resolveOnManualCancel(order.status);
    if (transition.action === 'none') throw new BadRequestException(`Cannot cancel an order in ${order.status}`);

    const reason = dto.reason ?? 'Cancelled by customer';
    await this.orderModel.updateOne({ _id: order._id }, { $set: { status: OrderStatus.Cancelled, reason } });
    const producer = childContext(context);
    const cancelled: OrderCancelledEvent = this.baseEvent(order, {
      orderId: String(order._id),
      customerId: order.customerId,
      restaurantId: order.restaurantId,
      reason,
    });
    await this.rabbit.publish(RoutingKey.OrderCancelled, cancelled, producer);

    const refund: PaymentRefundRequestedEvent = this.baseEvent(order, { orderId: String(order._id), reason });
    await this.rabbit.publish(RoutingKey.PaymentRefundRequested, refund, childContext(context));
    return this.findById(id);
  }

  private async commit(eventId: string, order: Order & { _id: Types.ObjectId }, updates: Record<string, unknown>): Promise<boolean> {
    const update: Record<string, unknown> = { $addToSet: { processedEvents: eventId } };
    if (Object.keys(updates).length > 0) update.$set = updates;
    const result = await this.orderModel.updateOne(
      { _id: order._id, status: order.status, processedEvents: { $ne: eventId } },
      update,
    );
    return result.matchedCount > 0;
  }

  private async handleEvent({ payload, context, routingKey }: EventContext): Promise<void> {
    const eventId = payload.eventId as string;
    if (!eventId || !isValidObjectId(payload.orderId)) return;
    const order = await this.orderModel.findById(payload.orderId);
    if (!order || order.processedEvents.includes(eventId)) return;

    if (routingKey === RoutingKey.PaymentCompleted) {
      const event = payload as PaymentCompletedEvent;
      const transition = resolveOnPaymentResult(order.status, 'completed');
      if (transition.action === 'none') return;
      const applied = await this.commit(eventId, order, {
        ...(transition.action === 'confirm' ? { status: transition.status, paymentId: event.paymentId } : {}),
      });
      if (!applied) return;
      const producer = childContext(context);

      if (transition.action === 'confirm') {
        const confirmed: OrderConfirmedEvent = this.baseEvent(order, {
          orderId: String(order._id),
          customerId: order.customerId,
          restaurantId: order.restaurantId,
          totalAmount: order.totalAmount,
        });
        await this.rabbit.publish(RoutingKey.OrderConfirmed, confirmed, producer);
      } else {
        const refund: PaymentRefundRequestedEvent = this.baseEvent(order, {
          orderId: String(order._id),
          reason: 'Order cancelled before payment settled',
        });
        await this.rabbit.publish(RoutingKey.PaymentRefundRequested, refund, producer);
      }
      return;
    }

    if (routingKey === RoutingKey.PaymentFailed) {
      const event = payload as PaymentFailedEvent;
      const transition = resolveOnPaymentResult(order.status, 'failed');
      if (transition.action !== 'cancel') return;
      const applied = await this.commit(eventId, order, { status: OrderStatus.Cancelled, reason: event.reason });
      if (!applied) return;
      const cancelled: OrderCancelledEvent = this.baseEvent(order, {
        orderId: String(order._id),
        customerId: order.customerId,
        restaurantId: order.restaurantId,
        reason: event.reason,
      });
      await this.rabbit.publish(RoutingKey.OrderCancelled, cancelled, childContext(context));
      return;
    }

    if (routingKey === RoutingKey.StockReservationFailed) {
      const event = payload as StockReservationFailedEvent;
      const transition = resolveOnStockFailure(order.status);
      if (transition.action !== 'cancel') return;
      const applied = await this.commit(eventId, order, { status: OrderStatus.Cancelled, reason: event.reason });
      if (!applied) return;
      const producer = childContext(context);
      const cancelled: OrderCancelledEvent = this.baseEvent(order, {
        orderId: String(order._id),
        customerId: order.customerId,
        restaurantId: order.restaurantId,
        reason: event.reason,
      });
      await this.rabbit.publish(RoutingKey.OrderCancelled, cancelled, producer);
      const refund: PaymentRefundRequestedEvent = this.baseEvent(order, {
        orderId: String(order._id),
        reason: event.reason,
      });
      await this.rabbit.publish(RoutingKey.PaymentRefundRequested, refund, childContext(context));
      return;
    }

    if (routingKey === RoutingKey.DeliveryAssigned) {
      const event = payload as DeliveryAssignedEvent;
      await this.commit(eventId, order, {
        deliveryId: event.deliveryId,
        courierName: event.courierName,
        etaMinutes: event.etaMinutes,
      });
    }
  }
}
