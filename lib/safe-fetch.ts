import "server-only";
import { resolve4, resolve6 } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { validPublicHostname } from "./integration-validation";

function privateAddress(address:string):boolean{const clean=address.toLowerCase();if(isIP(clean)===4){const p=clean.split(".").map(Number);return p[0]===10||p[0]===127||p[0]===0||(p[0]===169&&p[1]===254)||(p[0]===172&&p[1]>=16&&p[1]<=31)||(p[0]===192&&p[1]===168)||p[0]>=224;}return clean==="::"||clean==="::1"||clean.startsWith("fc")||clean.startsWith("fd")||/^fe[89ab]/.test(clean);}

export async function fetchPinnedHttpsText(hostname:string,path:string,maxBytes=16_384):Promise<string>{
  const host=hostname.toLowerCase().replace(/^www\./,""); if(!validPublicHostname(host)||!/^[\x20-\x7e]+$/.test(path)||!path.startsWith("/"))throw new Error("INVALID_TARGET");
  const [v4,v6]=await Promise.all([resolve4(host).catch(()=>[]),resolve6(host).catch(()=>[])]);const addresses=[...v4,...v6];if(!addresses.length||addresses.some(privateAddress))throw new Error("INVALID_TARGET");const address=addresses[0];const family=isIP(address) as 4|6;
  return new Promise((resolve,reject)=>{const req=httpsRequest({hostname:host,servername:host,port:443,path,method:"GET",headers:{"user-agent":"BidIndex-Domain-Verification/1.0","accept":"text/plain"},lookup:(_hostname,_options,callback)=>callback(null,address,family)},(response)=>{if(response.statusCode!==200){response.resume();reject(new Error("NOT_FOUND"));return;}const chunks:Buffer[]=[];let total=0;response.on("data",(chunk:Buffer)=>{total+=chunk.length;if(total>maxBytes){req.destroy(new Error("TOO_LARGE"));return;}chunks.push(chunk);});response.on("end",()=>resolve(Buffer.concat(chunks).toString("utf8")));});req.setTimeout(6000,()=>req.destroy(new Error("TIMEOUT")));req.on("error",reject);req.end();});
}
