import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read=(path:string)=>readFileSync(new URL(path,import.meta.url),"utf8");
const adminPage=read("../../app/admin/page.tsx");
const adminProducts=read("../admin-products.ts");
const detailRoute=read("../../app/api/admin/products/[slug]/details/route.ts");
const table=read("../../components/AdminProductTable.tsx");
const publicData=read("../product-data.ts");
const publicPage=read("../../app/product/[slug]/page.tsx");
const css=read("../../app/globals.css");

test("admin product page exposes private founder fields behind admin authentication",()=>{
  assert.match(adminPage,/listAdminProducts/);
  assert.match(table,/Private email/);
  assert.match(table,/Founder X/);
  assert.match(adminProducts,/contact_email/);
  assert.match(detailRoute,/validAdminRequest/);
  assert.match(detailRoute,/cache-control":"no-store/);
});

test("admin detail DTO never selects or returns owner and verification secrets",()=>{
  assert.doesNotMatch(adminProducts,/token_hash|preference_token|verification_token|approval_token|provider_id/);
  assert.doesNotMatch(detailRoute,/token_hash|preference_token|verification_token|approval_token/);
});

test("public product projections do not expose private founder information",()=>{
  assert.doesNotMatch(publicData,/CARD_COLUMNS[\s\S]{0,1400}contact_email/);
  assert.doesNotMatch(publicPage,/contact_email|contactEmail|preference_token|token_hash/);
});

test("admin products use a compact responsive table and details side panel",()=>{
  assert.match(table,/<table/);
  assert.match(table,/Edit listing/);
  assert.match(table,/role="dialog"/);
  assert.match(css,/@media\s*\(max-width:\s*700px\)[\s\S]*admin-product-table/);
  assert.match(css,/admin-detail-panel/);
});
