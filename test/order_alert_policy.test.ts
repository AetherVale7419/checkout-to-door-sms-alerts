import assert from "node:assert/strict";
import test from "node:test";
import { chooseCustomerAlert, orderUpdateSchema } from "../src/order_alert_policy";

test("checkout stays quiet while fulfillment and receipts notify the customer", () => {
  const checkout = orderUpdateSchema.parse({
    kind: "checkout_completed",
    orderId: "SIDE-1042",
    customerPhone: "+15550102030",
    totalCents: 4900,
  });
  assert.equal(chooseCustomerAlert(checkout), null);

  const shipped = orderUpdateSchema.parse({
    kind: "fulfillment_shipped",
    orderId: "SIDE-1042",
    customerPhone: "+15550102030",
    trackingNumber: "TRACK-8801",
  });
  const first = chooseCustomerAlert(shipped);
  const replay = chooseCustomerAlert(shipped);
  assert.deepEqual(first, {
    to: "+15550102030",
    body: "Order SIDE-1042 shipped. Tracking: TRACK-8801.",
    idempotency_key: "order/SIDE-1042/fulfillment_shipped",
  });
  assert.equal(replay?.idempotency_key, first?.idempotency_key);

  const receipt = orderUpdateSchema.parse({
    kind: "receipt_ready",
    orderId: "SIDE-1042",
    customerPhone: "+15550102030",
    receiptUrl: "https://shop.example/receipts/SIDE-1042",
  });
  assert.match(chooseCustomerAlert(receipt)?.body ?? "", /Receipt for order SIDE-1042/);
});
