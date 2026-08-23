import { infrai } from "../src/infrai_sms";
import { chooseCustomerAlert, orderUpdateSchema } from "../src/order_alert_policy";

if (!process.env.INFRAI_API_KEY) throw new Error("INFRAI_API_KEY is required");
if (!process.env.DEMO_CUSTOMER_PHONE) throw new Error("DEMO_CUSTOMER_PHONE is required");

const update = orderUpdateSchema.parse({
  kind: "fulfillment_shipped",
  orderId: "SIDE-1042",
  customerPhone: process.env.DEMO_CUSTOMER_PHONE,
  trackingNumber: "TRACK-8801",
});
const alert = chooseCustomerAlert(update);
if (!alert) throw new Error("This fulfillment update must produce an alert");

const result = await infrai.sms.send(alert);
console.log(`Sent fulfillment update ${result.message_id} for ${update.orderId}`);
