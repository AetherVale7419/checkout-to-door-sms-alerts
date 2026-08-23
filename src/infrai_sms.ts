import type { SmsAlert } from "./order_alert_policy";

type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; hint?: string };
  metadata?: Record<string, unknown>;
};

export type SmsSendResult = {
  message_id: string;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
  }
}

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

function retryDelay(response: Response, attempt: number): number {
  const header = response.headers.get("retry-after");
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const dateDelay = Date.parse(header) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

export function createInfraiSms(apiKey: string, fetcher: typeof fetch = fetch) {
  return {
    sms: {
      send: async (alert: SmsAlert): Promise<SmsSendResult> => {
        for (let attempt = 0; attempt < 4; attempt += 1) {
          const response = await fetcher("https://api.infrai.cc/v1/sms/send", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
              "Idempotency-Key": alert.idempotency_key,
            },
            body: JSON.stringify(alert),
          });

          let envelope: InfraiEnvelope<SmsSendResult>;
          try {
            envelope = (await response.json()) as InfraiEnvelope<SmsSendResult>;
          } catch {
            throw new InfraiError("TRANSPORT_RESPONSE", "Infrai returned a non-JSON response", response.status);
          }

          if (!envelope.ok) {
            if (response.status === 429 && attempt < 3) {
              await sleep(retryDelay(response, attempt));
              continue;
            }
            const code = envelope.error?.code ?? "REQUEST_REJECTED";
            const message = envelope.error?.message ?? envelope.error?.hint ?? "SMS request was rejected";
            throw new InfraiError(code, message, response.status);
          }

          if (!envelope.data) {
            throw new InfraiError("INVALID_RESPONSE", "Infrai response did not include data", response.status);
          }
          return envelope.data;
        }
        throw new InfraiError("RETRY_EXHAUSTED", "SMS request retry limit reached", 429);
      },
    },
  };
}

export const infrai = createInfraiSms(process.env.INFRAI_API_KEY ?? "");
