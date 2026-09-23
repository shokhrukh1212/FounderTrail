import { brand } from "./brand";

/**
 * Keep the verified mailbox from EMAIL_FROM while making the public sender name
 * independent from stale deployment configuration left over from the old brand.
 */
export function formatEmailFrom(configuredFrom: string, senderName: string = brand.displayName): string {
  const configured = configuredFrom.trim();
  if (!configured) return "";

  const email = configured.match(/<([^>]+)>/)?.[1]?.trim() || configured;
  const name = (senderName.trim() || brand.displayName)
    .replace(/BidIndex/gi, brand.displayName)
    .replace(/[<>\r\n]/g, "");

  return `${name} <${email}>`;
}
