import { NextResponse } from "next/server";
import { ADMIN_COOKIE,adminCookieOptions,adminSecretMatches,createAdminSession } from "@/lib/admin-auth";
import { config } from "@/lib/config";
import { requestOriginIsSameSite } from "@/lib/request-security";
export async function POST(request:Request){if(!requestOriginIsSameSite(request))return NextResponse.json({error:"Invalid origin."},{status:403});if(!config.adminAccessSecret)return NextResponse.json({error:"Admin access is not configured."},{status:503});const body=await request.json().catch(()=>null) as {secret?:unknown}|null;if(typeof body?.secret!=="string"||!adminSecretMatches(body.secret))return NextResponse.json({error:"Access denied."},{status:401});const response=NextResponse.json({ok:true});response.cookies.set(ADMIN_COOKIE,createAdminSession(),adminCookieOptions);return response;}
