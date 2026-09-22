import { NextResponse } from "next/server";


/** Older clients fail explicitly; weekly and permanent support now share the
 * canonical product-upvote action. */
export async function PUT() {
  return NextResponse.json({ error: "This endpoint was retired. Use the product upvote action." }, { status: 410 });
}
