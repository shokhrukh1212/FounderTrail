import type { CampaignTemplateKey,MessageClass } from "./email-templates";

export type AudienceCandidate = {
  product_id:string;preference_id:string;normalized_email:string;preference_token_version:number;
  marketing_opt_in_at:Date|null;marketing_unsubscribed_at:Date|null;suppression_reasons:string[];
  slug:string;name:string;founder_name:string|null;status:string;submitted_at:Date;approved_at:Date|null;
  token_version:number;logo_url:string|null;verified:boolean;domain_verified:boolean;badge_active:boolean;
  claimed:boolean;biddex_founder:boolean;
  share_intent:boolean;product_views:number;product_upvotes:number;referred_visitors:number;product_rank:number;
};

export type AudienceRecipient={
  email:string;founderName:string|null;marketingOptedIn:boolean;
  product:{id:string;slug:string;name:string;status:string};
  groupedProducts:Array<{id:string;slug:string;name:string;status:string}>;
};
export type AudienceExclusion={email:string;founderName:string|null;product:{id:string;name:string};reasons:string[]};
export type AudienceReview={selectedCount:number;eligibleCount:number;excludedCount:number;count:number;recipients:AudienceRecipient[];exclusions:AudienceExclusion[];marketingAudience:{eligible:number;total:number}};

const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const product=(row:AudienceCandidate)=>({id:row.product_id,slug:row.slug,name:row.name,status:row.status});
const representativeOrder=(a:AudienceCandidate,b:AudienceCandidate)=>{
  const published=Number(b.status==="published")-Number(a.status==="published");
  return published||new Date(b.submitted_at).getTime()-new Date(a.submitted_at).getTime()||a.product_id.localeCompare(b.product_id);
};

export function eligibilityReasons(row:AudienceCandidate,messageClass:MessageClass,templateKey?:CampaignTemplateKey):string[]{
  const reasons:string[]=[];
  if(!EMAIL.test(row.normalized_email))reasons.push("Invalid or missing email");
  if(templateKey==="claim_invitation"&&row.claimed)reasons.push("Product already has a verified owner");
  if(messageClass==="marketing"){
    if(row.marketing_unsubscribed_at)reasons.push("Unsubscribed from marketing/growth emails");
    for(const reason of row.suppression_reasons)if(reason!=="unsubscribe"||!row.marketing_unsubscribed_at)reasons.push(`Suppressed: ${reason}`);
  }else{
    for(const reason of row.suppression_reasons)if(reason!=="unsubscribe")reasons.push(`Suppressed: ${reason}`);
  }
  return [...new Set(reasons)];
}

export function evaluateAudience(rows:AudienceCandidate[],messageClass:MessageClass,templateKey?:CampaignTemplateKey):AudienceReview&{eligibleRows:AudienceCandidate[]}{
  const groups=new Map<string,AudienceCandidate[]>();
  for(const row of rows){const key=EMAIL.test(row.normalized_email)?row.normalized_email:`invalid:${row.product_id}`;const group=groups.get(key)??[];group.push(row);groups.set(key,group)}
  const recipients:AudienceRecipient[]=[];const exclusions:AudienceExclusion[]=[];const eligibleRows:AudienceCandidate[]=[];
  for(const group of groups.values()){
    const ordered=[...group].sort(representativeOrder);const chosen=ordered[0];const reasons=eligibilityReasons(chosen,messageClass,templateKey);
    if(reasons.length){exclusions.push({email:chosen.normalized_email,founderName:chosen.founder_name,product:{id:chosen.product_id,name:chosen.name},reasons});continue}
    eligibleRows.push(chosen);recipients.push({email:chosen.normalized_email,founderName:chosen.founder_name,marketingOptedIn:!chosen.marketing_unsubscribed_at,product:product(chosen),groupedProducts:ordered.map(product)});
  }
  return{selectedCount:groups.size,eligibleCount:recipients.length,excludedCount:exclusions.length,count:recipients.length,recipients,exclusions,marketingAudience:{eligible:messageClass==="marketing"?recipients.length:0,total:groups.size},eligibleRows};
}
