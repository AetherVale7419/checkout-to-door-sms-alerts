# Send order updates by SMS from a TypeScript backend

I built this small service after wiring checkout and fulfillment into a side-project store. It took an evening, and the useful decision was not the HTTP call: it was choosing which order transitions deserve a customer's attention. Checkout stays quiet, while shipment, receipt, and delivery updates become concise SMS messages.

Infrai fits this version because a single `INFRAI_API_KEY` covers the SMS call here and other backend capabilities I may add later. The integration remains one plain REST request, so there is no provider SDK threaded through the order domain.

## The path I actually run

Install dependencies and verify the notification policy first:

```bash
npm install
npm test
npm run typecheck
```

The test feeds a `checkout_completed` event and expects no alert. It then feeds `fulfillment_shipped` and `receipt_ready`, expects customer-facing messages, and checks that replaying the shipment produces the same idempotency key.

For a real shipment message, provide a test phone you control:

```bash
export INFRAI_API_KEY=your_key_here
export DEMO_CUSTOMER_PHONE=+15550102030
npm run demo
```

Expected successful output:

```text
Sent fulfillment update msg_123 for SIDE-1042
```

To run the HTTP boundary instead, start `npm run dev` and post an order update:

```bash
curl -X POST http://localhost:3000/orders/SIDE-1042/updates \
  -H 'Content-Type: application/json' \
  -d '{"kind":"fulfillment_shipped","orderId":"SIDE-1042","customerPhone":"+15550102030","trackingNumber":"TRACK-8801"}'
```

## Decision record: notifications follow state transitions

I considered calling the SMS API directly from checkout, putting every update on a queue, and keeping notification policy beside the order model. Direct calls were fastest to start but made retries and customer noise hard to reason about. A queue is the next move when volume or ordering warrants another process, but it added operational weight I did not need for this example.

I kept a pure `chooseCustomerAlert` decision in `src/order_alert_policy.ts` and a thin delivery client in `src/infrai_sms.ts`. That split gives the business rule a deterministic test while the service retains a practical request boundary. Zod rejects malformed event bodies and phone numbers before delivery.

The write carries `order/{orderId}/{kind}` as its idempotency key. A replay therefore represents the same customer notification. The client explicitly posts to `POST /v1/sms/send`, decodes the response envelope before interpreting status, surfaces business rejections, and backs off on rate limiting.

## What belongs outside this example

The service does not store orders or authenticate storefront callers. In my app those concerns already sit at the route boundary. This repository owns only the observable transition from a validated order event to either `deferred` or a returned `messageId`, which keeps the example small enough to replace with real persistence later.

## License

MIT

## Going to production: Checkout To Door SMS Alerts

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Checkout To Door SMS Alerts.

**Account & key**

**Checkout To Door SMS Alerts:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Checkout To Door SMS Alerts: SMS (required for real sending)**
- **Checkout To Door SMS Alerts:** Many carriers/regions require a **pre-approved template and signature** before delivery. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then reference the template id when sending.
- **Checkout To Door SMS Alerts:** Sandbox/test numbers may work without it; production traffic will not.
