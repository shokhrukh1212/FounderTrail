import { NextResponse } from "next/server";

function retired() {
  return NextResponse.json({ error: "Founder-connected Stripe revenue and MRR are not available in this release." }, { status: 410 });
}

export const GET = retired;
export const POST = retired;
export const PATCH = retired;
export const DELETE = retired;
