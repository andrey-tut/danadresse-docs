/**
 * Offline contract checks for the MCP tool catalogue (no network).
 * The live round-trip lives in integration.test.ts (INTEGRATION=1).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { TOOLS } from "../tools.js";

describe("MCP tool catalogue", () => {
  const entries = Object.entries(TOOLS);

  it("exposes 11 tools keyed by their own name", () => {
    assert.equal(entries.length, 11);
    for (const [key, def] of entries) assert.equal(def.name, key);
  });

  it("every tool has a description, an object JSON schema and a handler", () => {
    for (const [key, def] of entries) {
      assert.ok(def.description && def.description.length > 20, `${key}: description`);
      assert.equal(def.inputSchema.type, "object", `${key}: inputSchema.type`);
      assert.equal(typeof def.handler, "function", `${key}: handler`);
    }
  });

  it("autocomplete_address validates input with zod (min length 2, default limit)", () => {
    const z = TOOLS.autocomplete_address.zod;
    assert.equal(z.safeParse({ query: "a" }).success, false);
    const ok = z.safeParse({ query: "Rådhus" });
    assert.ok(ok.success);
    assert.equal((ok as { data: { limit: number } }).data.limit, 10);
  });
});
