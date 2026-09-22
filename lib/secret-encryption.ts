import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { config } from "./config";

function encryptionKey(): Buffer {
  const raw = config.metricEncryptionKey.trim();
  const key = /^[a-f0-9]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("METRIC_ENCRYPTION_KEY must be 32 bytes encoded as base64 or 64 hex characters.");
  return key;
}

export function encryptMetricSecret(value: string): { encrypted: Buffer; iv: Buffer; tag: Buffer } {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from("foundertrail:stripe-metric:v1"));
  return { encrypted: Buffer.concat([cipher.update(value, "utf8"), cipher.final()]), iv, tag: cipher.getAuthTag() };
}

export function decryptMetricSecret(encrypted: Buffer, iv: Buffer, tag: Buffer): string {
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAAD(Buffer.from("foundertrail:stripe-metric:v1"));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
