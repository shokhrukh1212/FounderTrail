import assert from "node:assert/strict";
import test from "node:test";
import { parseXHandleInput, storedXHandleStatus } from "../x-handle";

test("founder X handles must be entered as @handle or an X profile link", () => {
  assert.deepEqual(parseXHandleInput(""), { ok: true, handle: null });
  assert.deepEqual(parseXHandleInput("  @alex_smith "), { ok: true, handle: "@alex_smith" });
  for (const link of ["https://x.com/alexsmith", "http://twitter.com/alexsmith/", "x.com/alexsmith", "https://www.x.com/alexsmith?s=21", "https://mobile.twitter.com/alexsmith"]) {
    assert.deepEqual(parseXHandleInput(link), { ok: true, handle: "@alexsmith" }, link);
  }
  for (const bad of ["alexsmith", "Alex Smith", "my name", "@alex smith", "@", "@thisnameiswaytoolong", "https://x.com/home", "@search", "https://x.com/alexsmith/status/1", "https://linkedin.com/in/alexsmith", "alex@example.com"]) {
    assert.equal(parseXHandleInput(bad).ok, false, bad);
  }
});

test("stored founder handles are classified for the admin filter", () => {
  assert.equal(storedXHandleStatus(null), "missing");
  assert.equal(storedXHandleStatus("  "), "missing");
  assert.equal(storedXHandleStatus("@alexsmith"), "valid");
  assert.equal(storedXHandleStatus("Alex Smith"), "invalid");
  assert.equal(storedXHandleStatus("alexsmith"), "invalid");
  assert.equal(storedXHandleStatus("@home"), "invalid");
});
