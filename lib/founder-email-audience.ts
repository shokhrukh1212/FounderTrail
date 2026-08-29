import type { MessageClass } from "./email-templates";

export type AudienceCandidate = {
  product_id:string;preference_id:string;normalized_email:string;preference_token_version:number;
  marketing_opt_in_at:Date|null;marketing_unsubscribed_at:Date|null;suppression_reasons:string[];
  slug:string;name:string;founder_name:string|null;status:string;submitted_at:Date;approved_at:Date|null;
  token_version:number;logo_url:string|null;verified:boolean;domain_verified:boolean;badge_active:boolean;
  share_intent:boolean;product_views:number;product_upvotes:number;referred_visitors:number;product_rank:number;
};

export type AudienceRecipient={
  email:string;founderName:string|null;marketingOptedIn:boolean;
  product:{id:string;slug:string;name:string;status:string};
  groupedProducts:Array<{id:string;slug:string;name:string;status:string}>;
};
export type AudienceExclusion={email:string;founderName:string|null;product:{id:string;name:string};reasons:string[]};
export type AudienceReview={selectedCount:number;eligibleCount:number;excludedCount:number;count:number;recipients:AudienceRecipient[];exclusions:AudienceExclusion[];marketingConsent:{agreed:number;total:number}};

const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const product=(row:AudienceCandidate)=>({id:row.product_id,slug:row.slug,name:row.name,status:row.status});
const representativeOrder=(a:AudienceCandidate,b:AudienceCandidate)=>{
  const published=Number(b.status==="published")-Number(a.status==="published");
  return published||new Date(b.submitted_at).getTime()-new Date(a.submitted_at).getTime()||a.product_id.localeCompare(b.product_id);
};

export function eligibilityReasons(row:AudienceCandidate,messageClass:MessageClass):string[]{
  const reasons:string[]=[];
  if(!EMAIL.test(row.normalized_email))reasons.push("Invalid or missing email");
  if(messageClass==="marketing"){
    if(!row.marketing_opt_in_at)reasons.push("Did not opt in to marketing/growth emails");
    if(row.marketing_unsubscribed_at)reasons.push("Unsubscribed from marketing/growth emails");
    for(const reason of row.suppression_reasons)if(reason!=="unsubscribe")reasons.push(`Suppressed: ${reason}`);
  }else{
    for(const reason of row.suppression_reasons)if(reason!=="unsubscribe")reasons.push(`Suppressed: ${reason}`);
  }
  return [...new Set(reasons)];
}

export function evaluateAudience(rows:AudienceCandidate[],messageClass:MessageClass):AudienceReview&{eligibleRows:AudienceCandidate[]}{
  const groups=new Map<string,AudienceCandidate[]>();
  for(const row of rows){const key=EMAIL.test(row.normalized_email)?row.normalized_email:`invalid:${row.product_id}`;const group=groups.get(key)??[];group.push(row);groups.set(key,group)}
  const recipients:AudienceRecipient[]=[];const exclusions:AudienceExclusion[]=[];const eligibleRows:AudienceCandidate[]=[];let agreed=0;
  for(const group of groups.values()){
    const ordered=[...group].sort(representativeOrder);const chosen=ordered[0];const reasons=eligibilityReasons(chosen,messageClass);
    if(chosen.marketing_opt_in_at&&!chosen.marketing_unsubscribed_at)agreed++;
    if(reasons.length){for(const row of ordered)exclusions.push({email:row.normalized_email,founderName:row.founder_name,product:{id:row.product_id,name:row.name},reasons});continue}
    eligibleRows.push(chosen);recipients.push({email:chosen.normalized_email,founderName:chosen.founder_name,marketingOptedIn:!!chosen.marketing_opt_in_at&&!chosen.marketing_unsubscribed_at,product:product(chosen),groupedProducts:ordered.map(product)});
    for(const duplicate of ordered.slice(1))exclusions.push({email:duplicate.normalized_email,founderName:duplicate.founder_name,product:{id:duplicate.product_id,name:duplicate.name},reasons:[`Duplicate normalized email; using ${chosen.name}`]});
  }
  return{selectedCount:rows.length,eligibleCount:recipients.length,excludedCount:rows.length-recipients.length,count:recipients.length,recipients,exclusions,marketingConsent:{agreed,total:groups.size},eligibleRows};
}
