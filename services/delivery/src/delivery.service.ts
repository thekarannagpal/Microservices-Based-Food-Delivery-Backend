import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  childContext,
  DeliveryAssignedEvent,
  DeliveryStatusUpdatedEvent,
  EventContext,
  OrderConfirmedEvent,
  RabbitClient,
  RoutingKey,
  TraceContext,
} from '@nexvia/shared';
import { Delivery, DeliveryStatus } from './delivery.schema';

const COURIERS = ['Arjun', 'Meera', 'Rohan', 'Priya'];

@Injectable()
export class DeliveryService implements OnModuleInit {
  constructor(
    @InjectModel(Delivery.name) private readonly deliveryModel: Model<Delivery>,
    private readonly rabbit: RabbitClient,
  ) {}

  async onModuleInit() {
    await this.rabbit.consume('delivery.events', [RoutingKey.OrderConfirmed], (event) => this.handleOrderConfirmed(event));
  }

  async findById(id: string) {
    const delivery = await this.deliveryModel.findById(id);
    if (!delivery) throw new NotFoundException('Delivery not found');
    return delivery;
  }

  async findByOrderId(orderId: string) {
    const delivery = await this.deliveryModel.findOne({ orderId });
    if (!delivery) throw new NotFoundException('Delivery not found for order');
    return delivery;
  }

  async findAll() {
    return this.deliveryModel.find().sort({ createdAt: -1 });
  }

  async updateStatus(id: string, status: DeliveryStatus, context: TraceContext) {
    const delivery = await this.findById(id);
    const order = [
      DeliveryStatus.Requested,
      DeliveryStatus.Assigned,
      DeliveryStatus.PickedUp,
      DeliveryStatus.Delivered,
    ];
    if (order.indexOf(status) !== order.indexOf(delivery.status) + 1) {
      throw new BadRequestException(`Cannot move from ${delivery.status} to ${status}`);
    }
    await this.deliveryModel.updateOne({ _id: delivery._id }, { $set: { status } });
    const event: DeliveryStatusUpdatedEvent = {
      eventId: '',
      occurredAt: new Date().toISOString(),
      correlationId: delivery.correlationId,
      orderId: delivery.orderId,
      deliveryId: String(delivery._id),
      status,
    };
    await this.rabbit.publish(RoutingKey.DeliveryStatusUpdated, event, childContext(context));
    return this.findById(id);
  }

  private async handleOrderConfirmed({ payload, context }: EventContext): Promise<void> {
    const event = payload as OrderConfirmedEvent;
    const eventId = payload.eventId as string;
    if (!eventId) return;
    const existing = await this.deliveryModel.findOne({ orderId: event.orderId });
    if (existing) return;

    const delivery = await this.deliveryModel.create({
      orderId: event.orderId,
      customerId: event.customerId,
      restaurantId: event.restaurantId,
      status: DeliveryStatus.Requested,
      correlationId: event.correlationId,
      processedEvents: [eventId],
    });

    await this.rabbit.publish(
      RoutingKey.DeliveryRequested,
      {
        correlationId: event.correlationId,
        deliveryId: String(delivery._id),
        orderId: event.orderId,
        address: delivery.address,
      },
      childContext(context),
    );

    // Simulate a dispatcher assigning a courier shortly after the request.
    setTimeout(async () => {
      try {
        const courierName = COURIERS[Math.floor(Math.random() * COURIERS.length)];
        const etaMinutes = 25 + Math.floor(Math.random() * 15);
        await this.deliveryModel.updateOne(
          { _id: delivery._id, status: DeliveryStatus.Requested },
          { $set: { status: DeliveryStatus.Assigned, courierName, etaMinutes } },
        );
        const assigned: DeliveryAssignedEvent = {
          eventId: '',
          occurredAt: new Date().toISOString(),
          correlationId: event.correlationId,
          orderId: event.orderId,
          deliveryId: String(delivery._id),
          courierName,
          etaMinutes,
        };
        await this.rabbit.publish(RoutingKey.DeliveryAssigned, assigned, childContext(context));
      } catch (error) {
        console.error('[delivery] courier assignment failed:', error);
      }
    }, 800);
  }
}
