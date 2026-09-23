import { NextResponse } from "next/server";
import { getProAvailability } from "@/lib/pro-launch";
import { isProLaunchConfigured } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const availability = await getProAvailability();
  return NextResponse.json({ ...availability, configured: isProLaunchConfigured() }, { headers: { "cache-control": "no-store" } });
}
