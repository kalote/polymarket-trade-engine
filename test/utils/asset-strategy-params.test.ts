import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Env, ASSET_STRATEGY_DEFAULTS, type AssetStrategyParams } from "../../utils/config.ts";

describe("AssetStrategyParams", () => {
  let savedAsset: string | undefined;

  beforeEach(() => {
    savedAsset = process.env.MARKET_ASSET;
  });

  afterEach(() => {
    if (savedAsset === undefined) {
      delete process.env.MARKET_ASSET;
    } else {
      process.env.MARKET_ASSET = savedAsset;
    }
  });

  test("returns correct params for each asset", () => {
    for (const asset of ["btc", "eth", "sol", "doge", "xrp"] as const) {
      process.env.MARKET_ASSET = asset;
      const params = Env.getStrategyParams();
      expect(params).toEqual(ASSET_STRATEGY_DEFAULTS[asset]);
    }
  });

  test("falls back to btc for unknown asset", () => {
    process.env.MARKET_ASSET = "btc";
    const params = Env.getStrategyParams();
    expect(params).toEqual(ASSET_STRATEGY_DEFAULTS.btc);
  });

  test("eth has more shares than doge", () => {
    expect(ASSET_STRATEGY_DEFAULTS.eth.shares).toBeGreaterThan(
      ASSET_STRATEGY_DEFAULTS.doge.shares
    );
  });

  test("all assets have maxEntryPrice of 0.98", () => {
    for (const asset of Object.values(ASSET_STRATEGY_DEFAULTS)) {
      expect(asset.maxEntryPrice).toBe(0.98);
    }
  });

  test("eth shares=50, minShares=15, liquidityFullSize=200", () => {
    expect(ASSET_STRATEGY_DEFAULTS.eth.shares).toBe(50);
    expect(ASSET_STRATEGY_DEFAULTS.eth.minShares).toBe(15);
    expect(ASSET_STRATEGY_DEFAULTS.eth.liquidityFullSize).toBe(200);
  });

  test("sol shares=40, minShares=10, liquidityFullSize=150", () => {
    expect(ASSET_STRATEGY_DEFAULTS.sol.shares).toBe(40);
    expect(ASSET_STRATEGY_DEFAULTS.sol.minShares).toBe(10);
    expect(ASSET_STRATEGY_DEFAULTS.sol.liquidityFullSize).toBe(150);
  });

  test("doge shares=25, minShares=8, liquidityFullSize=80", () => {
    expect(ASSET_STRATEGY_DEFAULTS.doge.shares).toBe(25);
    expect(ASSET_STRATEGY_DEFAULTS.doge.minShares).toBe(8);
    expect(ASSET_STRATEGY_DEFAULTS.doge.liquidityFullSize).toBe(80);
  });
});
