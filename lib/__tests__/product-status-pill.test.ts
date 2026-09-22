import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductStatusPill } from "../../components/ProductStatusPill";

test("owner status pills name and colour each listing state",()=>{
  const pill=(status:string)=>renderToStaticMarkup(createElement(ProductStatusPill,{status}));
  assert.equal(pill("published"),'<span class="product-status-pill is-published">Live</span>');
  assert.equal(pill("pending"),'<span class="product-status-pill is-pending">Pending review</span>');
  assert.equal(pill("rejected"),'<span class="product-status-pill is-rejected">Changes requested</span>');
  assert.equal(pill("something_new"),'<span class="product-status-pill is-draft">something new</span>');
  const myProducts=readFileSync(new URL("../../app/my-products/page.tsx",import.meta.url),"utf8");
  assert.match(myProducts,/<ProductStatusPill status=\{product\.status\} \/>/);
});
