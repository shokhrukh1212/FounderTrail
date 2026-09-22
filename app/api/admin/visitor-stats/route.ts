import { NextResponse } from "next/server";
import { validAdminRequest } from "@/lib/admin-auth";
import { getAdminVisitorStat } from "@/lib/visitors";

export const dynamic = "force-dynamic";

/** Backs the admin subnav stat. Admin-only: the public counter stays on /api/visitors. */
export async function GET(request: Request) {
  if (!(await validAdminRequest(request))) {
    return NextResponse.json({ error: "Admin access required." }, { status: 401 });
  }
  return NextResponse.json(await getAdminVisitorStat(), { headers: { "cache-control": "no-store" } });
}
