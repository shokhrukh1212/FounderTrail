import assert from "node:assert/strict";
import test from "node:test";
import { evaluateAudience, type AudienceCandidate } from "../founder-email-audience";

function candidate(overrides:Partial<AudienceCandidate>={}):AudienceCandidate{
  return {product_id:"product-1",preference_id:"preference-1",normalized_email:"ada@example.com",preference_token_version:1,marketing_opt_in_at:new Date("2026-08-01"),marketing_unsubscribed_at:null,suppression_reasons:[],slug:"atlas",name:"Atlas",founder_name:"Ada",status:"published",submitted_at:new Date("2026-08-01"),approved_at:new Date("2026-08-02"),token_version:1,logo_url:null,verified:false,domain_verified:false,badge_active:false,share_intent:false,product_views:12,product_upvotes:3,referred_visitors:2,product_rank:4,...overrides};
}

test("one-founder and selected-founder audiences preserve final recipient details",()=>{
  const one=evaluateAudience([candidate()],"marketing");
  assert.deepEqual({selected:one.selectedCount,eligible:one.eligibleCount,excluded:one.excludedCount},{selected:1,eligible:1,excluded:0});
  assert.deepEqual(one.recipients[0]?.product,{id:"product-1",slug:"atlas",name:"Atlas",status:"published"});
  const selected=evaluateAudience([candidate(),candidate({product_id:"product-2",preference_id:"preference-2",normalized_email:"grace@example.com",founder_name:"Grace",name:"Compiler",slug:"compiler"})],"marketing");
  assert.deepEqual(selected.recipients.map(item=>item.email),["ada@example.com","grace@example.com"]);
});

test("all eligible founders are returned once and remain separate sends",()=>{
  const rows=[candidate(),candidate({product_id:"product-2",preference_id:"preference-2",normalized_email:"grace@example.com",founder_name:"Grace",name:"Compiler",slug:"compiler"}),candidate({product_id:"product-3",preference_id:"preference-3",normalized_email:"linus@example.com",founder_name:"Linus",name:"Kernel",slug:"kernel"})];
  const review=evaluateAudience(rows,"marketing");
  assert.equal(review.eligibleRows.length,3);
  assert.equal(new Set(review.eligibleRows.map(row=>row.normalized_email)).size,3);
  assert.equal(review.excludedCount,0);
});

test("normalized-email duplicates send once, preferring published then newest",()=>{
  const rows=[candidate({product_id:"old-pending",name:"Old pending",status:"pending",submitted_at:new Date("2026-08-20")}),candidate({product_id:"published",name:"Published choice",status:"published",submitted_at:new Date("2026-08-01")}),candidate({product_id:"new-pending",name:"New pending",status:"pending",submitted_at:new Date("2026-08-25")})];
  const review=evaluateAudience(rows,"marketing");
  assert.equal(review.eligibleCount,1);
  assert.equal(review.recipients[0]?.product.id,"published");
  assert.equal(review.recipients[0]?.groupedProducts.length,3);
  assert.equal(review.excludedCount,2);
  assert.ok(review.exclusions.every(item=>item.reasons[0]?.includes("Duplicate normalized email")));
});

test("marketing excludes non-opt-in and unsubscribed founders with explicit reasons",()=>{
  const review=evaluateAudience([candidate({product_id:"no-consent",normalized_email:"no@example.com",marketing_opt_in_at:null}),candidate({product_id:"unsubscribed",normalized_email:"stop@example.com",marketing_unsubscribed_at:new Date("2026-08-28"),suppression_reasons:["unsubscribe"]})],"marketing");
  assert.equal(review.eligibleCount,0);
  assert.equal(review.excludedCount,2);
  assert.match(review.exclusions.find(item=>item.product.id==="no-consent")!.reasons.join(" "),/Did not opt in/);
  assert.match(review.exclusions.find(item=>item.product.id==="unsubscribed")!.reasons.join(" "),/Unsubscribed/);
});

test("product-owner updates ignore marketing unsubscribe but retain delivery suppressions",()=>{
  const review=evaluateAudience([candidate({product_id:"owner-update",marketing_unsubscribed_at:new Date("2026-08-28"),suppression_reasons:["unsubscribe"]}),candidate({product_id:"bounced",normalized_email:"bounce@example.com",suppression_reasons:["bounce"]})],"transactional");
  assert.equal(review.eligibleCount,1);
  assert.equal(review.recipients[0]?.product.id,"owner-update");
  assert.match(review.exclusions[0]!.reasons.join(" "),/Suppressed: bounce/);
});
