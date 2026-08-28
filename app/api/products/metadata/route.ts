import { NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";
import { consumeRateLimit } from "@/lib/rate-limit";
import { networkHash, requestOriginIsSameSite } from "@/lib/request-security";
import { fetchSubmissionMetadata, signMetadata } from "@/lib/submission-metadata";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!requestOriginIsSameSite(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const body = await request.json().catch(() => null) as { url?: unknown } | null;
  if (typeof body?.url !== "string" || body.url.length > 2048) return NextResponse.json({ error: "Enter a valid public website URL." }, { status: 400 });
  const allowed = await withTransaction((client) => consumeRateLimit(client, { action: "metadata", keyHash: networkHash(request, "metadata"), limit: 20, windowSeconds: 3600 }));
  if (!allowed) return NextResponse.json({ error: "Too many metadata requests. Try again later." }, { status: 429 });
  try {
    const metadata = await fetchSubmissionMetadata(body.url);
    return NextResponse.json({ metadata, token: signMetadata(metadata) });
  } catch {
    return NextResponse.json({ error: "Enter a valid public website URL." }, { status: 400 });
  }
}
