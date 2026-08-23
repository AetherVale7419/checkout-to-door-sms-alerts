import { createServer } from "node:http";
import { InfraiError, infrai } from "./infrai_sms";
import { chooseCustomerAlert, orderUpdateSchema } from "./order_alert_policy";

async function readJson(request: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function json(response: import("node:http").ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(value));
}

export const server = createServer(async (request, response) => {
  const match = request.url?.match(/^\/orders\/([^/]+)\/updates$/);
  if (request.method !== "POST" || !match) {
    json(response, 404, { error: "route_not_found" });
    return;
  }

  try {
    const parsed = orderUpdateSchema.safeParse(await readJson(request));
    if (!parsed.success || parsed.data.orderId !== decodeURIComponent(match[1])) {
      json(response, 400, { error: "invalid_order_update" });
      return;
    }

    const alert = chooseCustomerAlert(parsed.data);
    if (!alert) {
      json(response, 202, { orderId: parsed.data.orderId, notification: "deferred" });
      return;
    }

    const sent = await infrai.sms.send(alert);
    json(response, 202, {
      orderId: parsed.data.orderId,
      notification: "sent",
      messageId: sent.message_id,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      json(response, 400, { error: "invalid_json" });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      json(response, status, { error: error.code, message: error.message });
      return;
    }
    json(response, 500, { error: "request_failed" });
  }
});

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? 3000);
  server.listen(port, () => console.log(`Order update service listening on http://localhost:${port}`));
}
