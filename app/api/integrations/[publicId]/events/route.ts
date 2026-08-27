import { NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";
import { bearerSecret, integrationSecretMatches } from "@/lib/integration-security";
import { validEventId, validEventTime } from "@/lib/integration-validation";
import { networkHash } from "@/lib/request-security";
import { consumeRateLimit } from "@/lib/rate-limit";

const TYPES = new Set(["purchase_completed","bid_completed","revenue_recorded"]);
export async function POST(request: Request, context: RouteContext<"/api/integrations/[publicId]/events">) {
  const { publicId } = await context.params;
  const secret = bearerSecret(request);
  if (!secret) return NextResponse.json({ error: { code: "authentication_required", message: "Send the integration secret as a Bearer token." } }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string,unknown>|null;
  const eventId=body?.eventId, type=body?.type, valueMinor=body?.valueMinor, currency=typeof body?.currency==="string"?body.currency.toUpperCase():"", occurred=validEventTime(body?.occurredAt);
  if (!validEventId(eventId) || typeof type!=="string" || !TYPES.has(type) || !Number.isSafeInteger(valueMinor) || (valueMinor as number)<0 || !/^[A-Z]{3}$/.test(currency) || !occurred) return NextResponse.json({ error: { code: "invalid_event", message: "Use a unique eventId, supported type, non-negative integer valueMinor, currency, and timestamp within ten minutes." } }, { status: 400 });
  try {
    const result = await withTransaction(async (client) => {
      const integrations=await client.query<{id:string;product_id:string;secret_hash:string}>(`SELECT id::text,product_id::text,secret_hash FROM product_integrations WHERE public_id::text=$1 LIMIT 1`,[publicId]); const integration=integrations.rows[0];
      if(!integration||!integrationSecretMatches(integration.secret_hash,secret)) throw new Error("AUTH");
      const allowed=await consumeRateLimit(client,{action:"server-event",keyHash:networkHash(request,`server-event:${integration.id}`),limit:120,windowSeconds:60}); if(!allowed)throw new Error("RATE");
      const inserted=await client.query(`INSERT INTO product_metric_events (integration_id,product_id,event_id,event_type,value_minor,currency,occurred_at) VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6,$7) ON CONFLICT (integration_id,event_id) DO NOTHING RETURNING id`,[integration.id,integration.product_id,eventId,type,valueMinor,currency,occurred]);
      if(!inserted.rowCount)return {duplicate:true};
      const increments: Array<[string,string,number,"add"|"max"|"set"]> = [];
      if(type==="purchase_completed") increments.push(["purchases","",1,"add"],["revenue",currency,valueMinor as number,"add"]);
      if(type==="bid_completed") increments.push(["bids","",1,"add"],["revenue",currency,valueMinor as number,"add"],["highest_bid",currency,valueMinor as number,"max"],["current_bid",currency,valueMinor as number,"set"]);
      if(type==="revenue_recorded") increments.push(["revenue",currency,valueMinor as number,"add"]);
      for(const [metric,metricCurrency,value,mode] of increments) await client.query(`INSERT INTO product_metric_aggregates (product_id,metric_type,source,currency,value,last_event_at) VALUES ($1::uuid,$2,'verified_live',$3,$4,$5) ON CONFLICT (product_id,metric_type,source,currency) DO UPDATE SET value=CASE $6 WHEN 'max' THEN GREATEST(product_metric_aggregates.value,EXCLUDED.value) WHEN 'set' THEN EXCLUDED.value ELSE product_metric_aggregates.value+EXCLUDED.value END,last_event_at=EXCLUDED.last_event_at,updated_at=now()`,[integration.product_id,metric,metricCurrency,value,occurred,mode]);
      await client.query(`UPDATE product_integrations SET last_event_at=now(),updated_at=now() WHERE id=$1::uuid`,[integration.id]); return {duplicate:false};
    });
    return NextResponse.json({accepted:true,duplicate:result.duplicate},{status:result.duplicate?200:202});
  } catch(error) { const code=error instanceof Error?error.message:""; if(code==="AUTH")return NextResponse.json({error:{code:"invalid_authentication",message:"The project identifier or secret is invalid."}},{status:401}); if(code==="RATE")return NextResponse.json({error:{code:"rate_limited",message:"Too many events."}},{status:429}); console.error("integration event failed",code||"unknown"); return NextResponse.json({error:{code:"server_error",message:"Could not accept the event."}},{status:500}); }
}
