import { NextResponse } from "next/server";
import { getProAvailability } from "@/lib/pro-launch";

export const dynamic = "force-dynamic";

export async function GET() {
  const availability = await getProAvailability();
  return NextResponse.json(availability, { headers: { "cache-control": "no-store" } });
}
