import assert from 'node:assert/strict';
import test from 'node:test';
import { OrderStatus, resolveOnManualCancel, resolveOnPaymentResult, resolveOnStockFailure } from '../src/saga';

test('successful payment confirms a pending order', () => {
  assert.deepEqual(resolveOnPaymentResult(OrderStatus.PendingPayment, 'completed'), {
    status: OrderStatus.Confirmed,
    action: 'confirm',
  });
});

test('failed payment cancels a pending order', () => {
  assert.deepEqual(resolveOnPaymentResult(OrderStatus.PendingPayment, 'failed'), {
    status: OrderStatus.Cancelled,
    action: 'cancel',
  });
});

test('late payment on a cancelled order requests a refund instead of confirming', () => {
  assert.deepEqual(resolveOnPaymentResult(OrderStatus.Cancelled, 'completed'), {
    status: OrderStatus.Cancelled,
    action: 'refund',
  });
});

test('duplicate payment events are ignored', () => {
  assert.deepEqual(resolveOnPaymentResult(OrderStatus.Confirmed, 'completed'), {
    status: OrderStatus.Confirmed,
    action: 'none',
  });
});

test('stock failure cancels pending orders and compensates a completed payment', () => {
  assert.deepEqual(resolveOnStockFailure(OrderStatus.PendingPayment), {
    status: OrderStatus.Cancelled,
    action: 'cancel',
  });
  assert.equal(resolveOnStockFailure(OrderStatus.Confirmed).action, 'cancel');
  assert.equal(resolveOnStockFailure(OrderStatus.Cancelled).action, 'none');
});

test('manual cancellation is only allowed before delivery', () => {
  assert.equal(resolveOnManualCancel(OrderStatus.PendingPayment).action, 'cancel');
  assert.equal(resolveOnManualCancel(OrderStatus.Confirmed).action, 'cancel');
  assert.equal(resolveOnManualCancel(OrderStatus.Cancelled).action, 'none');
});
