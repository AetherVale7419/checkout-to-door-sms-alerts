import { z } from "zod";

export const orderUpdateSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("checkout_completed"),
    orderId: z.string().min(1),
    customerPhone: z.string().regex(/^\+[1-9]\d{7,14}$/),
    totalCents: z.number().int().nonnegative(),
  }),
  z.object({
    kind: z.literal("fulfillment_shipped"),
    orderId: z.string().min(1),
    customerPhone: z.string().regex(/^\+[1-9]\d{7,14}$/),
    trackingNumber: z.string().min(1),
  }),
  z.object({
    kind: z.literal("receipt_ready"),
    orderId: z.string().min(1),
    customerPhone: z.string().regex(/^\+[1-9]\d{7,14}$/),
    receiptUrl: z.string().url(),
  }),
  z.object({
    kind: z.literal("order_delivered"),
    orderId: z.string().min(1),
    customerPhone: z.string().regex(/^\+[1-9]\d{7,14}$/),
  }),
]);

export type OrderUpdate = z.infer<typeof orderUpdateSchema>;

export type SmsAlert = {
  to: string;
  body: string;
  idempotency_key: string;
};

export function chooseCustomerAlert(update: OrderUpdate): SmsAlert | null {
  const idempotency_key = `order/${update.orderId}/${update.kind}`;

  switch (update.kind) {
    case "checkout_completed":
      return null;
    case "fulfillment_shipped":
      return {
        to: update.customerPhone,
        body: `Order ${update.orderId} shipped. Tracking: ${update.trackingNumber}.`,
        idempotency_key,
      };
    case "receipt_ready":
      return {
        to: update.customerPhone,
        body: `Receipt for order ${update.orderId}: ${update.receiptUrl}`,
        idempotency_key,
      };
    case "order_delivered":
      return {
        to: update.customerPhone,
        body: `Order ${update.orderId} was delivered. Thanks for shopping with us.`,
        idempotency_key,
      };
  }
}
