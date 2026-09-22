import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth";
import { isAuthConfigured } from "@/lib/config";

const handler = toNextJsHandler(auth);

export async function GET(request: Request) {
  if (!isAuthConfigured()) return Response.json({ error: "Sign in is not configured." }, { status: 503 });
  return handler.GET(request);
}

export async function POST(request: Request) {
  if (!isAuthConfigured()) return Response.json({ error: "Sign in is not configured." }, { status: 503 });
  return handler.POST(request);
}
