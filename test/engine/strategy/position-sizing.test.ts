import { describe, test, expect } from "bun:test";
import { getPositionSize } from "../../../engine/strategy/late-entry.ts";
import type { AssetStrategyParams } from "../../../utils/config.ts";

const mockCfg: AssetStrategyParams = {
  shares: 50,
  minShares: 15,
  maxEntryPrice: 0.98,
  maxEntrySeconds: 120,
  initialStopDistance: 0.10,
  trailingStopDistance: 0.08,
  minLiquidity: 25,
  liquidityFullSize: 200,
  certaintyCutoff: 0.80,
};

describe("getPositionSize", () => {
  test("returns full shares when liquidity >= liquidityFullSize", () => {
    expect(getPositionSize(200, mockCfg)).toBe(50);
    expect(getPositionSize(300, mockCfg)).toBe(50);
  });

  test("returns minShares when liquidity <= minLiquidity", () => {
    expect(getPositionSize(25, mockCfg)).toBe(15);
    expect(getPositionSize(10, mockCfg)).toBe(15);
  });

  test("scales linearly between min and max", () => {
    // midpoint: liquidity = 112.5, ratio = (112.5-25)/(200-25) = 0.5
    // shares = 15 + 0.5 * (50-15) = 15 + 17.5 = 32.5 → round to 33
    const mid = (mockCfg.minLiquidity + mockCfg.liquidityFullSize) / 2;
    expect(getPositionSize(mid, mockCfg)).toBe(33);
  });

  test("low liquidity produces fewer shares than high liquidity", () => {
    expect(getPositionSize(30, mockCfg)).toBeLessThan(getPositionSize(150, mockCfg));
  });

  test("returns exact minShares at boundary", () => {
    expect(getPositionSize(mockCfg.minLiquidity, mockCfg)).toBe(mockCfg.minShares);
  });

  test("returns exact shares at upper boundary", () => {
    expect(getPositionSize(mockCfg.liquidityFullSize, mockCfg)).toBe(mockCfg.shares);
  });

  test("works with different asset configs (doge-like)", () => {
    const dogeCfg: AssetStrategyParams = {
      shares: 25,
      minShares: 8,
      maxEntryPrice: 0.98,
      maxEntrySeconds: 120,
      initialStopDistance: 0.10,
      trailingStopDistance: 0.08,
      minLiquidity: 20,
      liquidityFullSize: 80,
      certaintyCutoff: 0.80,
    };
    // at liquidity 50: ratio = (50-20)/(80-20) = 0.5
    // shares = 8 + 0.5 * (25-8) = 8 + 8.5 = 16.5 → round to 17
    expect(getPositionSize(50, dogeCfg)).toBe(17);
  });

  test("never returns 0 shares", () => {
    expect(getPositionSize(0, mockCfg)).toBeGreaterThan(0);
    expect(getPositionSize(1, mockCfg)).toBeGreaterThan(0);
  });
});
