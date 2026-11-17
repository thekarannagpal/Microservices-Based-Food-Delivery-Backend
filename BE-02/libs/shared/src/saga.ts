/** Pure saga state transitions, kept framework-free so they can be unit-tested. */

export enum OrderStatus {
  PendingPayment = 'PENDING_PAYMENT',
  Confirmed = 'CONFIRMED',
  Cancelled = 'CANCELLED',
}

export enum PaymentStatus {
  Pending = 'PENDING',
  Completed = 'COMPLETED',
  Failed = 'FAILED',
  Refunded = 'REFUNDED',
}

export type SagaAction = 'confirm' | 'cancel' | 'refund' | 'none';

export interface Transition {
  status: OrderStatus;
  action: SagaAction;
}

export const isTerminal = (status: OrderStatus): boolean =>
  status === OrderStatus.Confirmed || status === OrderStatus.Cancelled;

/**
 * Payment results drive the order state. A late success on an order that was
 * already cancelled by a stock failure triggers compensation (refund).
 */
export function resolveOnPaymentResult(status: OrderStatus, result: 'completed' | 'failed'): Transition {
  if (status === OrderStatus.PendingPayment) {
    return result === 'completed'
      ? { status: OrderStatus.Confirmed, action: 'confirm' }
      : { status: OrderStatus.Cancelled, action: 'cancel' };
  }
  if (status === OrderStatus.Cancelled && result === 'completed') {
    return { status: OrderStatus.Cancelled, action: 'refund' };
  }
  return { status, action: 'none' };
}

/** Insufficient stock cancels the order and asks payments to refund if needed. */
export function resolveOnStockFailure(status: OrderStatus): Transition {
  if (status === OrderStatus.Cancelled) return { status, action: 'none' };
  return { status: OrderStatus.Cancelled, action: 'cancel' };
}

export function resolveOnManualCancel(status: OrderStatus): Transition {
  if (status === OrderStatus.PendingPayment || status === OrderStatus.Confirmed) {
    return { status: OrderStatus.Cancelled, action: 'cancel' };
  }
  return { status, action: 'none' };
}
