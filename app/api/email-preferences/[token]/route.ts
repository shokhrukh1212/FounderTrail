import { unsubscribeByToken } from "@/lib/email-preferences";

export async function POST(_request:Request,context:RouteContext<"/api/email-preferences/[token]">){const {token}=await context.params;return await unsubscribeByToken(token)?new Response(null,{status:200,headers:{"cache-control":"no-store"}}):new Response(null,{status:404,headers:{"cache-control":"no-store"}})}
export async function GET(request:Request,context:RouteContext<"/api/email-preferences/[token]">){const {token}=await context.params;const target=new URL("/email-preferences",request.url);target.hash=`token=${encodeURIComponent(token)}`;return Response.redirect(target,303)}
