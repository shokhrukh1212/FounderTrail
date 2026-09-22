import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "./config";
import { currentUserFromHeaders } from "./auth";

export const ADMIN_COOKIE = "bidindex_admin";
function adminSigningSecret(){return config.adminAccessSecret||config.auth.secret;}
function signature(expires:string){return createHmac("sha256",adminSigningSecret()||"disabled").update(`bidindex-admin\0${expires}`).digest("hex");}
export function createAdminSession(now=Date.now()):string{const expires=String(now+8*60*60_000);return `${expires}.${signature(expires)}`;}
export function validAdminSession(value:string|null,now=Date.now()):boolean{if(!adminSigningSecret()||!value)return false;const [expires,provided,...rest]=value.split(".");if(rest.length||!/^\d{13}$/.test(expires)||!/^[a-f0-9]{64}$/.test(provided)||Number(expires)<now)return false;const expected=signature(expires);return timingSafeEqual(Buffer.from(expected),Buffer.from(provided));}
export function adminSecretMatches(value:string):boolean{if(!config.adminAccessSecret)return false;const expected=createHmac("sha256",config.adminAccessSecret).update("expected").digest();const provided=createHmac("sha256",value).update("expected").digest();return timingSafeEqual(expected,provided);}
export const adminCookieOptions={httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict" as const,path:"/",maxAge:8*60*60};
export function adminSessionFromRequest(request:Request):string|null{for(const part of (request.headers.get("cookie")??"").split(";")){const [name,...rest]=part.trim().split("=");if(name===ADMIN_COOKIE)return decodeURIComponent(rest.join("="));}return null;}
export async function validAdminRequest(request: Request): Promise<boolean> {
  if (validAdminSession(adminSessionFromRequest(request))) return true;
  const user = await currentUserFromHeaders(request.headers).catch(() => null);
  return user?.role === "admin";
}

export async function validAdminPageSession(requestHeaders: Headers, legacySession: string | null): Promise<boolean> {
  if (validAdminSession(legacySession)) return true;
  const user = await currentUserFromHeaders(requestHeaders).catch(() => null);
  return user?.role === "admin";
}
