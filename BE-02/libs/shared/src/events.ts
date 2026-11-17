import type { TraceContext } from './tracing';

export const EVENT_EXCHANGE = 'nexvia.events';

export enum RoutingKey {
  OrderPlaced = 'order.placed',
  OrderConfirmed = 'order.confirmed',
  OrderCancelled = 'order.cancelled',
  StockReserved = 'stock.reserved',
  StockReservationFailed = 'stock.reservation.failed',
  PaymentCompleted = 'payment.completed',
  PaymentFailed = 'payment.failed',
  PaymentRefundRequested = 'payment.refund.requested',
  PaymentRefunded = 'payment.refunded',
  DeliveryRequested = 'delivery.requested',
  DeliveryAssigned = 'delivery.assigned',
  DeliveryStatusUpdated = 'delivery.status.updated',
}

export interface EventMetadata {
  eventId: string;
  occurredAt: string;
  correlationId: string;
  traceparent?: string;
}

export interface OrderItemSnapshot {
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface OrderPlacedEvent extends EventMetadata {
  orderId: string;
  customerId: string;
  restaurantId: string;
  items: OrderItemSnapshot[];
  subtotal: number;
  deliveryFee: number;
  tax: number;
  totalAmount: number;
}

export interface PaymentCompletedEvent extends EventMetadata {
  orderId: string;
  paymentId: string;
  amount: number;
}

export interface PaymentFailedEvent extends EventMetadata {
  orderId: string;
  paymentId: string;
  amount: number;
  reason: string;
}

export interface PaymentRefundRequestedEvent extends EventMetadata {
  orderId: string;
  reason: string;
}

export interface PaymentRefundedEvent extends EventMetadata {
  orderId: string;
  paymentId: string;
  amount: number;
  reason: string;
}

export interface StockReservationFailedEvent extends EventMetadata {
  orderId: string;
  restaurantId: string;
  reason: string;
}

export interface StockReservedEvent extends EventMetadata {
  orderId: string;
  restaurantId: string;
}

export interface OrderConfirmedEvent extends EventMetadata {
  orderId: string;
  customerId: string;
  restaurantId: string;
  totalAmount: number;
}

export interface OrderCancelledEvent extends EventMetadata {
  orderId: string;
  customerId: string;
  restaurantId: string;
  reason: string;
}

export interface DeliveryAssignedEvent extends EventMetadata {
  orderId: string;
  deliveryId: string;
  courierName: string;
  etaMinutes: number;
}

export interface DeliveryStatusUpdatedEvent extends EventMetadata {
  orderId: string;
  deliveryId: string;
  status: string;
}

export interface EventContext {
  payload: any;
  context: TraceContext;
  routingKey: string;
}
