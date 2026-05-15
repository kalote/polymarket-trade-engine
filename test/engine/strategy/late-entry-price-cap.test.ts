import { describe, test, expect } from "bun:test";
import { ASSET_STRATEGY_DEFAULTS } from "../../../utils/config.ts";

describe("late-entry MAX_ENTRY_PRICE cap", () => {
  test("all assets have maxEntryPrice = 0.98", () => {
    for (const [asset, params] of Object.entries(ASSET_STRATEGY_DEFAULTS)) {
      expect(params.maxEntryPrice).toBe(0.98);
    }
  });

  test("maxEntryPrice is less than 1.0 (ensures the cap is meaningful)", () => {
    for (const [asset, params] of Object.entries(ASSET_STRATEGY_DEFAULTS)) {
      expect(params.maxEntryPrice).toBeLessThan(1.0);
    }
  });

  test("certaintyCutoff < maxEntryPrice (there's a valid entry window)", () => {
    for (const [asset, params] of Object.entries(ASSET_STRATEGY_DEFAULTS)) {
      expect(params.certaintyCutoff).toBeLessThan(params.maxEntryPrice);
    }
  });
});
