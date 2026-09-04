import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { PoolClient } from "pg";
import { config } from "./config";
import { query, withTransaction } from "./db";

export type EmailPreference = {
  id: string;
  normalizedEmail: string;
  marketingOptInAt: Date | null;
  marketingUnsubscribedAt: Date | null;
  tokenVersion: number;
  suppressed: boolean;
};

type PreferenceRow = {
  id: string;
  normalized_email: string;
  marketing_opt_in_at: Date | null;
  marketing_unsubscribed_at: Date | null;
  preference_token_version: number;
  suppressed: boolean;
};

export function normalizeEmail(value: string): string { return value.trim().toLowerCase(); }

function tokenSignature(payload: string): string {
  return createHmac("sha256", config.eventHashSalt).update(`bidindex:email-preference\0${payload}`).digest("base64url");
}

export function emailPreferenceToken(id: string, version: number): string {
  const payload = Buffer.from(JSON.stringify({ p: id, v: version }), "utf8").toString("base64url");
  return `v1.${payload}.${tokenSignature(payload)}`;
}

export function readEmailPreferenceToken(token: string): { id: string; version: number } | null {
  if (token.length > 512) return null;
  const [kind, payload, provided, ...extra] = token.split(".");
  if (extra.length || kind !== "v1" || !/^[A-Za-z0-9_-]+$/.test(payload ?? "") || !/^[A-Za-z0-9_-]{43}$/.test(provided ?? "")) return null;
  const expected = tokenSignature(payload);
  if (expected.length !== provided.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(provided))) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { p?: unknown; v?: unknown };
    return typeof decoded.p === "string" && /^[0-9a-f-]{36}$/i.test(decoded.p) && Number.isInteger(decoded.v) && Number(decoded.v) > 0
      ? { id: decoded.p, version: Number(decoded.v) } : null;
  } catch { return null; }
}

export function emailPreferenceUrl(siteUrl: string, token: string): string {
  return `${new URL("/email-preferences", `${siteUrl.replace(/\/+$/, "")}/`).toString()}#token=${encodeURIComponent(token)}`;
}

export function oneClickUnsubscribeUrl(siteUrl: string, token: string): string {
  return new URL(`/api/email-preferences/${encodeURIComponent(token)}`, `${siteUrl.replace(/\/+$/, "")}/`).toString();
}

export async function ensureFounderPreference(client: PoolClient, email: string, optIn: boolean): Promise<string> {
  // The table enforces "unsubscribed implies a recorded preference", so the opt-in
  // timestamp has to be stamped on every row this touches -- rows backfilled from older
  // submissions carry no opt-in, and leaving one NULL while stamping the unsubscribe
  // aborts the whole submission transaction. An existing unsubscribe stays sticky: a
  // later submission with the box ticked never silently re-subscribes a founder.
  const result = await client.query<{ id: string }>(
    `INSERT INTO founder_email_preferences (normalized_email,marketing_opt_in_at,marketing_unsubscribed_at)
     VALUES ($1,now(),CASE WHEN $2::boolean THEN NULL ELSE now() END)
     ON CONFLICT (normalized_email) DO UPDATE SET
       marketing_opt_in_at=COALESCE(founder_email_preferences.marketing_opt_in_at,now()),
       marketing_unsubscribed_at=CASE WHEN founder_email_preferences.marketing_unsubscribed_at IS NULL AND NOT $2::boolean
         THEN now() ELSE founder_email_preferences.marketing_unsubscribed_at END,
       updated_at=now()
     RETURNING id::text`, [normalizeEmail(email), optIn]);
  return result.rows[0].id;
}

export async function getEmailPreferenceByToken(token: string): Promise<EmailPreference | null> {
  const parsed = readEmailPreferenceToken(token); if (!parsed) return null;
  const rows = await query<PreferenceRow>(
    `SELECT p.id::text,p.normalized_email,p.marketing_opt_in_at,p.marketing_unsubscribed_at,p.preference_token_version,
            EXISTS (SELECT 1 FROM founder_email_suppressions s WHERE s.normalized_email=p.normalized_email) AS suppressed
       FROM founder_email_preferences p WHERE p.id=$1::uuid AND p.preference_token_version=$2`, [parsed.id, parsed.version]);
  const row = rows[0];
  return row ? { id:row.id,normalizedEmail:row.normalized_email,marketingOptInAt:row.marketing_opt_in_at?new Date(row.marketing_opt_in_at):null,marketingUnsubscribedAt:row.marketing_unsubscribed_at?new Date(row.marketing_unsubscribed_at):null,tokenVersion:row.preference_token_version,suppressed:row.suppressed } : null;
}

export async function unsubscribeByToken(token: string): Promise<boolean> {
  const parsed = readEmailPreferenceToken(token); if (!parsed) return false;
  return withTransaction(async (client) => {
    const rows = await client.query<{ normalized_email: string }>(
      `UPDATE founder_email_preferences SET marketing_opt_in_at=COALESCE(marketing_opt_in_at,now()),
              marketing_unsubscribed_at=COALESCE(marketing_unsubscribed_at,now()),updated_at=now()
        WHERE id=$1::uuid AND preference_token_version=$2 RETURNING normalized_email`, [parsed.id,parsed.version]);
    const email=rows.rows[0]?.normalized_email; if(!email)return false;
    await client.query(`INSERT INTO founder_email_suppressions (normalized_email,reason) VALUES ($1,'unsubscribe') ON CONFLICT DO NOTHING`,[email]);
    return true;
  });
}

export async function updateOwnerMarketingPreference(productId: string, optedIn: boolean): Promise<"opted_in"|"unsubscribed"|"suppressed"|"unchanged"> {
  return withTransaction(async (client) => {
    const rows=await client.query<{id:string;normalized_email:string;marketing_opt_in_at:Date|null;marketing_unsubscribed_at:Date|null;suppressed:boolean}>(
      `SELECT pref.id::text,pref.normalized_email,pref.marketing_opt_in_at,pref.marketing_unsubscribed_at,
              EXISTS (SELECT 1 FROM founder_email_suppressions s WHERE s.normalized_email=pref.normalized_email) AS suppressed
         FROM products p JOIN founder_email_preferences pref ON pref.id=p.email_preference_id WHERE p.id=$1::uuid FOR UPDATE OF pref`,[productId]);
    const pref=rows.rows[0]; if(!pref)throw new Error("PREFERENCE_NOT_FOUND");
    if(pref.suppressed||pref.marketing_unsubscribed_at)return "suppressed";
    if(optedIn){if(pref.marketing_opt_in_at)return "unchanged";await client.query(`UPDATE founder_email_preferences SET marketing_opt_in_at=now(),updated_at=now() WHERE id=$1::uuid`,[pref.id]);return "opted_in";}
    await client.query(`UPDATE founder_email_preferences SET marketing_opt_in_at=COALESCE(marketing_opt_in_at,now()),marketing_unsubscribed_at=now(),updated_at=now() WHERE id=$1::uuid`,[pref.id]);
    await client.query(`INSERT INTO founder_email_suppressions (normalized_email,reason) VALUES ($1,'unsubscribe') ON CONFLICT DO NOTHING`,[pref.normalized_email]);
    return "unsubscribed";
  });
}
