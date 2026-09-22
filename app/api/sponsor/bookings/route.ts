import { NextResponse } from "next/server";

/** New sponsorship sales are retired. Legacy records and signed webhook
 * reconciliation remain available through their existing owner/admin paths. */
export async function POST() {
  return NextResponse.json(
    { error: "Sponsored placements are no longer sold. FounderTrail Pro provides launch tools without paid placement." },
    { status: 410 },
  );
}
