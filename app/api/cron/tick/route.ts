import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { runCampaignMaintenance } from "@/lib/delivery";
import { cleanupPartnerTracking } from "@/lib/partner-maintenance";
import { dispatchCampaignBatches } from "@/lib/founder-email-campaigns";
import { runFounderEmailMaintenance } from "@/lib/founder-email-maintenance";
import { syncVemetricDailyVisitors } from "@/lib/vemetric-stats";
import { runFounderTrailJobs } from "@/lib/foundertrail-jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Expires abandoned bids and retries durable analytics delivery. Safe to retry. */
async function handle(request: Request) {
  if (!config.cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  }

  const provided =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    new URL(request.url).searchParams.get("secret");

  if (provided !== config.cronSecret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const started = Date.now();
  const [reconciled, partnerCleanup, founderEmail, campaignDelivery, vemetricDays, founderTrail] = await Promise.all([
    runCampaignMaintenance(), cleanupPartnerTracking(), runFounderEmailMaintenance(), dispatchCampaignBatches(),
    // Each day has to be captured while Vemetric still buckets it daily.
    syncVemetricDailyVisitors().catch((error) => { console.error("vemetric sync failed", error instanceof Error ? error.message : "unknown"); return 0; }),
    runFounderTrailJobs(),
  ]);

  return NextResponse.json(
    { ok: true, ms: Date.now() - started, reconciled, partnerCleanup, founderEmail, campaignDelivery, vemetricDays, founderTrail },
    { headers: { "cache-control": "no-store" } },
  );
}

// Vercel Cron invokes this route with GET. Do not expose POST as an alias: a
// leaked scheduler secret or misconfigured external job can otherwise keep the
// serverless database awake continuously and exhaust its monthly compute quota.
export const GET = handle;
