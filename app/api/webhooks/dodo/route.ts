import { NextResponse } from "next/server";

import { config } from "@/lib/config";
import { getPool, withTransaction } from "@/lib/db";
import { verifiedDodoWebhook } from "@/lib/dodo";
import { minimalDodoEvent, processDodoEvent } from "@/lib/sponsorship";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const raw = await request.text();
  let event;
  try { event = verifiedDodoWebhook(raw, request.headers); }
  catch { return NextResponse.json({ error: "Invalid signature." }, { status: 400 }); }
  const webhookId = request.headers.get("webhook-id");
  if (!webhookId || webhookId.length > 255) return NextResponse.json({ error: "Missing webhook ID." }, { status: 400 });
  const supported = ["payment.succeeded","payment.processing","payment.failed","payment.cancelled","refund.succeeded","refund.failed"] as const;
  if (!supported.includes(event.type as typeof supported[number])) return NextResponse.json({ ok: true, ignored: true });
  try {
    const duplicate = await getPool().query(`INSERT INTO payment_webhook_receipts(webhook_id,provider,environment,event_type,provider_created_at,payload) VALUES($1,'dodo',$2,$3,$4,$5::jsonb) ON CONFLICT(webhook_id) DO NOTHING RETURNING webhook_id`, [webhookId, config.dodoPayments.environment, event.type, new Date(event.timestamp), JSON.stringify(minimalDodoEvent(event as Parameters<typeof minimalDodoEvent>[0]))]);
    if (!duplicate.rowCount) return NextResponse.json({ ok: true, duplicate: true });
    await withTransaction(async (client) => {
      const outcome = await processDodoEvent(client, event as Parameters<typeof processDodoEvent>[1]);
      await client.query(`UPDATE payment_webhook_receipts SET processing_status=$2,attempts=attempts+1,processed_at=now(),last_error=NULL WHERE webhook_id=$1`, [webhookId, outcome]);
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    await getPool().query(`UPDATE payment_webhook_receipts SET processing_status='failed',attempts=attempts+1,last_error=$2 WHERE webhook_id=$1`, [webhookId, error instanceof Error ? error.message.slice(0,500) : "unknown"]).catch(() => {});
    console.error("Dodo webhook processing failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Processing failed." }, { status: 500 });
  }
}
