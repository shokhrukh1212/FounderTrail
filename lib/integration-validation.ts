import { isIP } from "node:net";
import { config } from "./config";

function privateV4(host: string) { const p=host.split(".").map(Number); return p[0]===10||p[0]===127||p[0]===0||(p[0]===169&&p[1]===254)||(p[0]===172&&p[1]>=16&&p[1]<=31)||(p[0]===192&&p[1]===168)||p[0]>=224; }
function privateV6(host: string) { const h=host.toLowerCase(); return h==="::"||h==="::1"||h.startsWith("fc")||h.startsWith("fd")||/^fe[89ab]/.test(h); }
export function validPublicHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^www\./, "").replace(/^\[|\]$/g, "");
  if (config.allowLocalPartnerOrigins && (host === "localhost" || host === "127.0.0.1")) return true;
  if (!host || host === "localhost" || host.endsWith(".localhost")) return false;
  const version=isIP(host); if (version===4) return !privateV4(host); if (version===6) return !privateV6(host);
  return host.includes(".") && /^[a-z0-9.-]+$/.test(host) && !host.startsWith(".") && !host.endsWith(".");
}
export function allowedOrigin(origin: string | null, allowedDomain: string): boolean {
  if (!origin) return false;
  try { const url=new URL(origin); const host=url.hostname.toLowerCase().replace(/^www\./,""); return ["http:","https:"].includes(url.protocol) && validPublicHostname(host) && host===allowedDomain.toLowerCase().replace(/^www\./,""); } catch { return false; }
}
export function validEventId(value: unknown): value is string { return typeof value === "string" && /^[A-Za-z0-9_.:-]{8,120}$/.test(value); }
export function validEventTime(value: unknown, now=Date.now()): Date | null { if(typeof value!=="string")return null; const date=new Date(value); return Number.isFinite(date.getTime())&&Math.abs(date.getTime()-now)<=10*60_000?date:null; }

/** Mirrors the discovery ORDER BY: all-time upvotes, then all-time eligible outbound clicks. */
export type TrendingSignals = { voteCount: number; totalClicks: number; publishedAt: Date; id: string };
export function compareTrending(a: TrendingSignals, b: TrendingSignals): number {
  return b.voteCount - a.voteCount || b.totalClicks - a.totalClicks || b.publishedAt.getTime() - a.publishedAt.getTime() || a.id.localeCompare(b.id);
}
