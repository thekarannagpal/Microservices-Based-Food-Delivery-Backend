import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  childContext,
  EventContext,
  OrderPlacedEvent,
  PaymentCompletedEvent,
  PaymentFailedEvent,
  PaymentRefundRequestedEvent,
  PaymentRefundedEvent,
  PaymentStatus,
  RabbitClient,
  RoutingKey,
  TraceContext,
} from '@nexvia/shared';
import { Payment } from './payment.schema';

@Injectable()
export class PaymentsService implements OnModuleInit {
  constructor(
    @InjectModel(Payment.name) private readonly paymentModel: Model<Payment>,
    private readonly rabbit: RabbitClient,
  ) {}

  async onModuleInit() {
    await this.rabbit.consume(
      'payments.commands',
      [RoutingKey.OrderPlaced, RoutingKey.PaymentRefundRequested],
      (event) => this.handleEvent(event),
    );
  }

  async findById(id: string) {
    const payment = await this.paymentModel.findById(id);
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }

  async findByOrderId(orderId: string) {
    const payment = await this.paymentModel.findOne({ orderId });
    if (!payment) throw new NotFoundException('Payment not found for order');
    return payment;
  }

  async findAll(orderId?: string) {
    return this.paymentModel.find(orderId ? { orderId } : {}).sort({ createdAt: -1 });
  }

  async requestRefund(orderId: string, reason: string, context: TraceContext) {
    const payment = await this.findByOrderId(orderId);
    const event: PaymentRefundRequestedEvent = {
      eventId: '',
      occurredAt: new Date().toISOString(),
      correlationId: payment.correlationId,
      orderId,
      reason,
    };
    await this.rabbit.publish(RoutingKey.PaymentRefundRequested, event, childContext(context));
    return payment;
  }

  private shouldFail(event: OrderPlacedEvent): boolean {
    const customers = (process.env.PAYMENT_FAIL_CUSTOMERS ?? 'fail-customer')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const maxAmount = Number(process.env.PAYMENT_MAX_AMOUNT ?? 10000);
    const randomRate = Number(process.env.PAYMENT_FAILURE_RATE ?? 0);
    return customers.includes(event.customerId) || event.totalAmount > maxAmount || Math.random() < randomRate;
  }

  private async handleEvent({ payload, context, routingKey }: EventContext): Promise<void> {
    const eventId = payload.eventId as string;
    if (!eventId) return;

    if (routingKey === RoutingKey.OrderPlaced) {
      const event = payload as OrderPlacedEvent;
      const existing = await this.paymentModel.findOne({ orderId: event.orderId });
      if (existing) return;

      const payment = await this.paymentModel.create({
        orderId: event.orderId,
        amount: event.totalAmount,
        status: PaymentStatus.Pending,
        correlationId: event.correlationId,
        processedEvents: [eventId],
      });

      // Simulate an external payment gateway round trip.
      await new Promise((resolve) => setTimeout(resolve, 150));
      const failed = this.shouldFail(event);
      await this.paymentModel.updateOne(
        { _id: payment._id },
        { $set: { status: failed ? PaymentStatus.Failed : PaymentStatus.Completed, failureReason: failed ? 'Gateway declined the card' : '' } },
      );
      const producer = childContext(context);

      if (failed) {
        const eventOut: PaymentFailedEvent = {
          eventId: '',
          occurredAt: new Date().toISOString(),
          correlationId: event.correlationId,
          orderId: event.orderId,
          paymentId: String(payment._id),
          amount: event.totalAmount,
          reason: 'Gateway declined the card',
        };
        await this.rabbit.publish(RoutingKey.PaymentFailed, eventOut, producer);
      } else {
        const eventOut: PaymentCompletedEvent = {
          eventId: '',
          occurredAt: new Date().toISOString(),
          correlationId: event.correlationId,
          orderId: event.orderId,
          paymentId: String(payment._id),
          amount: event.totalAmount,
        };
        await this.rabbit.publish(RoutingKey.PaymentCompleted, eventOut, producer);
      }
      return;
    }

    if (routingKey === RoutingKey.PaymentRefundRequested) {
      const event = payload as PaymentRefundRequestedEvent;
      const payment = await this.paymentModel.findOne({ orderId: event.orderId });
      if (!payment || payment.processedEvents.includes(eventId) || payment.status === PaymentStatus.Refunded) return;

      await this.paymentModel.updateOne(
        { _id: payment._id },
        {
          $set: { status: PaymentStatus.Refunded, refundReason: event.reason },
          $addToSet: { processedEvents: eventId },
        },
      );
      const refunded: PaymentRefundedEvent = {
        eventId: '',
        occurredAt: new Date().toISOString(),
        correlationId: event.correlationId,
        orderId: event.orderId,
        paymentId: String(payment._id),
        amount: payment.amount,
        reason: event.reason,
      };
      await this.rabbit.publish(RoutingKey.PaymentRefunded, refunded, childContext(context));
    }
  }
}
