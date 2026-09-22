import "server-only";
import DodoPayments from "dodopayments";
import { config } from "./config";

let client: DodoPayments | null = null;

export function getDodoClient(): DodoPayments {
  if (!config.dodoPayments.apiKey) throw new Error("DODO_NOT_CONFIGURED");
  if (!client) client = new DodoPayments({
    bearerToken: config.dodoPayments.apiKey,
    webhookKey: config.dodoPayments.webhookKey || undefined,
    environment: config.dodoPayments.environment,
    timeout: 20_000,
    maxRetries: 2,
  });
  return client;
}

export function verifiedDodoWebhook(rawBody: string, headers: Headers) {
  const signatureHeaders: Record<string, string> = {};
  for (const name of ["webhook-id", "webhook-signature", "webhook-timestamp"]) {
    const value = headers.get(name);
    if (value) signatureHeaders[name] = value;
  }
  if (!config.dodoPayments.webhookKey) throw new Error("DODO_WEBHOOK_NOT_CONFIGURED");
  return getDodoClient().webhooks.unwrap(rawBody, { headers: signatureHeaders, key: config.dodoPayments.webhookKey });
}
