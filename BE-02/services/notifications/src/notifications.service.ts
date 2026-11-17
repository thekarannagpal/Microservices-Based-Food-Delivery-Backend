import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EventContext, RabbitClient, RoutingKey } from '@nexvia/shared';
import { Notification } from './notification.schema';

const SUBSCRIBED_EVENTS = [
  RoutingKey.OrderPlaced,
  RoutingKey.OrderConfirmed,
  RoutingKey.OrderCancelled,
  RoutingKey.PaymentCompleted,
  RoutingKey.PaymentFailed,
  RoutingKey.PaymentRefunded,
  RoutingKey.DeliveryRequested,
  RoutingKey.DeliveryAssigned,
  RoutingKey.DeliveryStatusUpdated,
  RoutingKey.StockReserved,
  RoutingKey.StockReservationFailed,
];

@Injectable()
export class NotificationsService implements OnModuleInit {
  constructor(
    @InjectModel(Notification.name) private readonly notificationModel: Model<Notification>,
    private readonly rabbit: RabbitClient,
  ) {}

  async onModuleInit() {
    await this.rabbit.consume('notifications.events', SUBSCRIBED_EVENTS, (event) => this.handleEvent(event));
  }

  async findAll(orderId?: string) {
    return this.notificationModel.find(orderId ? { orderId } : {}).sort({ createdAt: -1 });
  }

  async findById(id: string) {
    const notification = await this.notificationModel.findById(id);
    if (!notification) throw new NotFoundException('Notification not found');
    return notification;
  }

  private messageFor(routingKey: string, payload: any): string {
    switch (routingKey) {
      case RoutingKey.OrderPlaced:
        return `Order ${payload.orderId} placed for ₹${payload.totalAmount}`;
      case RoutingKey.OrderConfirmed:
        return `Order ${payload.orderId} confirmed; restaurant is preparing it`;
      case RoutingKey.OrderCancelled:
        return `Order ${payload.orderId} cancelled: ${payload.reason}`;
      case RoutingKey.PaymentCompleted:
        return `Payment ${payload.paymentId} captured for order ${payload.orderId}`;
      case RoutingKey.PaymentFailed:
        return `Payment failed for order ${payload.orderId}: ${payload.reason}`;
      case RoutingKey.PaymentRefunded:
        return `Payment refunded for order ${payload.orderId}: ${payload.reason}`;
      case RoutingKey.DeliveryRequested:
        return `Delivery requested for order ${payload.orderId}`;
      case RoutingKey.DeliveryAssigned:
        return `${payload.courierName} assigned to order ${payload.orderId} (ETA ${payload.etaMinutes} min)`;
      case RoutingKey.DeliveryStatusUpdated:
        return `Delivery for order ${payload.orderId} is now ${payload.status}`;
      case RoutingKey.StockReserved:
        return `Stock reserved for order ${payload.orderId}`;
      case RoutingKey.StockReservationFailed:
        return `Stock reservation failed for order ${payload.orderId}: ${payload.reason}`;
      default:
        return `Event ${routingKey} received for order ${payload.orderId}`;
    }
  }

  private async handleEvent({ payload, context, routingKey }: EventContext): Promise<void> {
    if (!payload.eventId) return;
    try {
      const notification = await this.notificationModel.create({
        eventId: payload.eventId,
        orderId: payload.orderId,
        type: routingKey,
        channel: 'in-app-log',
        message: this.messageFor(routingKey, payload),
        correlationId: payload.correlationId,
        traceId: context.traceId,
      });
      console.log(`[notification] trace=${context.traceId} ${notification.message}`);
    } catch (error) {
      // Duplicate delivery of the same event; the unique index keeps us idempotent.
      if ((error as { code?: number }).code !== 11000) throw error;
    }
  }
}
