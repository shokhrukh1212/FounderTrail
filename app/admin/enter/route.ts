import { NextResponse } from "next/server";

import { currentUserFromHeaders } from "@/lib/auth";
import { ADMIN_COOKIE, adminCookieOptions, createAdminSession } from "@/lib/admin-auth";
import { config } from "@/lib/config";

export async function GET(request: Request) {
  const user = await currentUserFromHeaders(request.headers);
  if (user?.role !== "admin" || (!config.adminAccessSecret && !config.auth.secret)) return NextResponse.redirect(new URL("/", config.siteUrl), 303);
  const response = NextResponse.redirect(new URL("/admin", config.siteUrl), 303);
  response.cookies.set(ADMIN_COOKIE, createAdminSession(), adminCookieOptions);
  return response;
}
