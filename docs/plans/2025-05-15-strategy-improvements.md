# Late-Entry Strategy Improvements Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Improve the late-entry strategy's risk/reward by adding a max entry price cap, dynamic per-asset parameters, liquidity-adaptive position sizing, and cross-asset BTC leading indicator.

**Architecture:** All changes are in `engine/strategy/late-entry.ts` and `utils/config.ts`. The strategy currently uses hardcoded constants — we'll replace them with a per-asset config system and add a BTC ticker feed to non-BTC bots. No changes to `market-lifecycle.ts` or `tracker/` modules.

**Tech Stack:** TypeScript (Bun runtime), `bun:test` + `sinon` for testing

**Repository:** `github.com/kalote/polymarket-trade-engine` (fork, branch `master`)

**Current state of `late-entry.ts`:** 514 lines. Key constants at line 217:
```ts
const SHARES = 8;
const INITIAL_STOP_DISTANCE = 0.10;
const TRAILING_STOP_DISTANCE = 0.08;
const MAX_ENTRY_SECONDS = 120;
```
Entry logic in `checkEntry()` at line 223: checks `remaining <= MAX_ENTRY_SECONDS`, `atr <= 5`, `gapSafety >= 20`, `divergence <= 15`, `peakGapRatio >= 0.60`, then `up.price > 0.80` or `down.price > 0.80`, and `liquidity >= 20`.

---

## Phase 1: Max Entry Price Cap

**Why:** Entries above $0.98 have terrible risk/reward — risking $0.80 (stop-loss) to make $0.02-$0.16. Data shows ETH bought at $0.999 earned $0.007, while $0.99 entry triggered a -$0.88 stop-loss. Entries at $0.85-$0.96 are the profitable sweet spot.

### Task 1.1: Add MAX_ENTRY_PRICE constant and test

**Objective:** Block entries where the token price exceeds $0.98.

**Files:**
- Modify: `engine/strategy/late-entry.ts` (lines 217-221 constants, line 269 in `checkEntry`)
- Create: `test/engine/strategy/late-entry-price-cap.test.ts`

**Step 1: Write failing test**

Create `test/engine/strategy/late-entry-price-cap.test.ts`:
```ts
import { describe, test, expect } from "bun:test";

// We need to test checkEntry indirectly through the strategy,
// or extract it. For now, test via the exported strategy behavior.
// The simplest approach: import the module and test checkEntry.

// checkEntry is not exported, so we test the behavior:
// When up.price > 0.98, the strategy should NOT place an order.
// When up.price <= 0.98 (e.g. 0.96), it should place an order.

describe("late-entry MAX_ENTRY_PRICE", () => {
  test("rejects entry when price > 0.98", () => {
    // This test will be implemented using FixtureRunner
    // once we extract checkEntry or make it testable.
    // For now, placeholder that fails:
    expect(true).toBe(false); // TODO: implement with fixture
  });
});
```

**Step 2: Run test to verify failure**

Run: `bun test test/engine/strategy/late-entry-price-cap.test.ts`
Expected: FAIL

**Step 3: Implement the change**

In `engine/strategy/late-entry.ts`, add constant after line 220:
```ts
const MAX_ENTRY_PRICE = 0.98;        // reject entries above this (risk/reward too poor)
```

In `checkEntry()`, after the liquidity check (currently line 269 `if (info.liquidity < 20) return null;`), add:
```ts
      if (info.price > MAX_ENTRY_PRICE) return null;  // risk/reward too poor at high prices
```

**Step 4: Update test to pass**

Rewrite the test using the FixtureRunner pattern from `test/engine/helpers/fixture-runner.ts`:
- Create a scenario where the orderbook has UP ask at $0.99 → verify no order placed
- Create a scenario where the orderbook has UP ask at $0.96 → verify order placed

**Step 5: Run tests, verify pass, commit**

```bash
bun test test/engine/strategy/late-entry-price-cap.test.ts
git add -A && git commit -m "feat: add MAX_ENTRY_PRICE=0.98 cap to reject poor risk/reward entries"
```

---

## Phase 2: Per-Asset Dynamic Parameters

**Why:** Each asset behaves differently. DOGE has thin books ($20-30 liquidity) but high win rate. ETH has deeper books but more volatile reversals. SOL is in between. One-size-fits-all constants leave money on the table or cause unnecessary losses.

**Key insight from data:**
- Low-liquidity markets ($20-30) cause severe stop-loss slippage (planned -$0.80 loss becomes -$1.20)
- DOGE: high frequency, small wins, needs smaller position size on thin books
- ETH: fewer trades, bigger moves, can handle larger positions on deep books
- SOL: middle ground

### Task 2.1: Define per-asset config type and defaults

**Objective:** Create a typed per-asset parameter config that replaces hardcoded constants.

**Files:**
- Modify: `engine/strategy/late-entry.ts` (replace constants with config lookup)
- Modify: `utils/config.ts` (add strategy params to asset config)

**Step 1: Define the type in `utils/config.ts`**

Add after the existing `ASSET_TICKER_MAP` (around line 75):

```ts
export interface AssetStrategyParams {
  shares: number;                // base position size
  minShares: number;             // minimum shares on low-liquidity books
  maxEntryPrice: number;         // reject entries above this price
  maxEntrySeconds: number;       // entry window before slot close
  initialStopDistance: number;   // stop-loss distance from entry
  trailingStopDistance: number;  // trailing stop distance from high water mark
  minLiquidity: number;          // minimum book liquidity in USDC
  liquidityFullSize: number;     // liquidity threshold for full position size
  certaintyCutoff: number;       // minimum price to consider "certain" (currently 0.80)
}

export const ASSET_STRATEGY_DEFAULTS: Record<MarketAsset, AssetStrategyParams> = {
  btc: {
    shares: 8,
    minShares: 4,
    maxEntryPrice: 0.98,
    maxEntrySeconds: 120,
    initialStopDistance: 0.10,
    trailingStopDistance: 0.08,
    minLiquidity: 30,          // BTC has deeper books, require more
    liquidityFullSize: 100,
    certaintyCutoff: 0.80,
  },
  eth: {
    shares: 8,
    minShares: 4,
    maxEntryPrice: 0.98,
    maxEntrySeconds: 120,
    initialStopDistance: 0.10,
    trailingStopDistance: 0.08,
    minLiquidity: 25,
    liquidityFullSize: 80,
    certaintyCutoff: 0.80,
  },
  sol: {
    shares: 8,
    minShares: 3,
    maxEntryPrice: 0.98,
    maxEntrySeconds: 120,
    initialStopDistance: 0.10,
    trailingStopDistance: 0.08,
    minLiquidity: 20,
    liquidityFullSize: 60,
    certaintyCutoff: 0.80,
  },
  doge: {
    shares: 6,              // smaller default — DOGE books are thinner
    minShares: 3,
    maxEntryPrice: 0.98,
    maxEntrySeconds: 120,
    initialStopDistance: 0.10,
    trailingStopDistance: 0.08,
    minLiquidity: 20,
    liquidityFullSize: 40,
    certaintyCutoff: 0.80,
  },
  xrp: {
    shares: 6,
    minShares: 3,
    maxEntryPrice: 0.98,
    maxEntrySeconds: 120,
    initialStopDistance: 0.10,
    trailingStopDistance: 0.08,
    minLiquidity: 20,
    liquidityFullSize: 40,
    certaintyCutoff: 0.80,
  },
};
```

**Step 2: Add helper to `Env` class**

```ts
static getStrategyParams(): AssetStrategyParams {
  const asset = Env.get("MARKET_ASSET") as MarketAsset;
  return ASSET_STRATEGY_DEFAULTS[asset] ?? ASSET_STRATEGY_DEFAULTS.btc;
}
```

**Step 3: Write test for config lookup**

Create `test/utils/asset-strategy-params.test.ts`:
```ts
import { describe, test, expect, afterEach } from "bun:test";
import { Env, ASSET_STRATEGY_DEFAULTS } from "../../utils/config";

describe("AssetStrategyParams", () => {
  const originalAsset = process.env.MARKET_ASSET;

  afterEach(() => {
    if (originalAsset) process.env.MARKET_ASSET = originalAsset;
    else delete process.env.MARKET_ASSET;
  });

  test("returns correct params for each asset", () => {
    for (const asset of ["eth", "sol", "doge"] as const) {
      process.env.MARKET_ASSET = asset;
      const params = Env.getStrategyParams();
      expect(params).toEqual(ASSET_STRATEGY_DEFAULTS[asset]);
    }
  });

  test("doge has smaller default shares than eth", () => {
    expect(ASSET_STRATEGY_DEFAULTS.doge.shares).toBeLessThan(
      ASSET_STRATEGY_DEFAULTS.eth.shares
    );
  });
});
```

**Step 4: Run tests, commit**

```bash
bun test test/utils/asset-strategy-params.test.ts
git add -A && git commit -m "feat: add per-asset strategy parameter config"
```

### Task 2.2: Refactor late-entry.ts to use per-asset config

**Objective:** Replace all hardcoded constants with config lookups.

**Files:**
- Modify: `engine/strategy/late-entry.ts`

**Step 1: Replace constants block (lines 217-220)**

Replace:
```ts
const SHARES = 8;
const INITIAL_STOP_DISTANCE = 0.10;
const TRAILING_STOP_DISTANCE = 0.08;
const MAX_ENTRY_SECONDS = 120;
```

With:
```ts
import { Env } from "../../utils/config";

const cfg = Env.getStrategyParams();
```

**Step 2: Update `checkEntry()` to accept config**

Change the function signature to accept `cfg: AssetStrategyParams` and use:
- `cfg.maxEntrySeconds` instead of `MAX_ENTRY_SECONDS`
- `cfg.certaintyCutoff` instead of hardcoded `0.80`
- `cfg.minLiquidity` instead of hardcoded `20`
- `cfg.maxEntryPrice` for the price cap

```ts
function checkEntry(params: { /* existing params */ }, cfg: AssetStrategyParams): EntrySignal | null {
  // ...
  if (remaining < 5) return null;
  // ...
  if (
    remaining <= cfg.maxEntrySeconds &&
    atr && atr <= 5 &&
    gapSafety && gapSafety >= 20 &&
    divergence <= 15 &&
    peakGapRatio && peakGapRatio >= 0.60
  ) {
    const upCertain = up != null && up.price > cfg.certaintyCutoff;
    const downCertain = down != null && down.price > cfg.certaintyCutoff;

    if (upCertain || downCertain) {
      const side: "UP" | "DOWN" = upCertain ? "UP" : "DOWN";
      const info = (side === "UP" ? up : down)!;

      if (info.liquidity < cfg.minLiquidity) return null;
      if (info.price > cfg.maxEntryPrice) return null;

      return {
        side,
        ask: info.price,
        gap: absGap,
        liquidity: info.liquidity,
        stopLossPrice: Math.max(info.price - cfg.initialStopDistance, 0.01),
      };
    }
  }
  return null;
}
```

**Step 3: Update `placeEntry()` to use liquidity-adaptive sizing**

Replace the hardcoded `SHARES` in `placeEntry()` with dynamic sizing:

```ts
function getPositionSize(liquidity: number, cfg: AssetStrategyParams): number {
  // Scale shares linearly between minShares and shares based on liquidity
  if (liquidity >= cfg.liquidityFullSize) return cfg.shares;
  if (liquidity <= cfg.minLiquidity) return cfg.minShares;

  const ratio = (liquidity - cfg.minLiquidity) / (cfg.liquidityFullSize - cfg.minLiquidity);
  return Math.round(cfg.minShares + ratio * (cfg.shares - cfg.minShares));
}
```

In `placeEntry()`, change the order request (currently around line 298):
```ts
const shares = getPositionSize(signal.liquidity, cfg);
// ...
req: { tokenId, action: "buy", price: signal.ask, shares },
```

**Step 4: Update `checkStopLoss()` to use config**

Replace references to `TRAILING_STOP_DISTANCE` and `INITIAL_STOP_DISTANCE` with `cfg.trailingStopDistance` and `cfg.initialStopDistance`.

**Step 5: Run all existing tests to verify no regression**

```bash
bun test
```

**Step 6: Commit**

```bash
git add -A && git commit -m "refactor: replace hardcoded constants with per-asset config in late-entry strategy"
```

### Task 2.3: Write tests for liquidity-adaptive position sizing

**Objective:** Verify that position sizing scales correctly with liquidity.

**Files:**
- Create: `test/engine/strategy/position-sizing.test.ts`

**Step 1: Write tests**

```ts
import { describe, test, expect } from "bun:test";
// Import getPositionSize — may need to export it or test indirectly

describe("getPositionSize", () => {
  const cfg = {
    shares: 8,
    minShares: 3,
    minLiquidity: 20,
    liquidityFullSize: 80,
    // ... other fields
  };

  test("returns full shares when liquidity >= liquidityFullSize", () => {
    expect(getPositionSize(100, cfg)).toBe(8);
    expect(getPositionSize(80, cfg)).toBe(8);
  });

  test("returns minShares when liquidity <= minLiquidity", () => {
    expect(getPositionSize(20, cfg)).toBe(3);
    expect(getPositionSize(15, cfg)).toBe(3);
  });

  test("scales linearly between min and max", () => {
    // midpoint: liquidity = 50, ratio = (50-20)/(80-20) = 0.5
    // shares = 3 + 0.5 * (8-3) = 5.5 → round to 6
    expect(getPositionSize(50, cfg)).toBe(6);
  });

  test("low liquidity = fewer shares = less slippage risk", () => {
    expect(getPositionSize(25, cfg)).toBeLessThan(getPositionSize(70, cfg));
  });
});
```

**Step 2: Export `getPositionSize` from late-entry.ts for testability**

Add at the bottom of the file or in a separate utility:
```ts
export { getPositionSize }; // for testing
```

**Step 3: Run tests, commit**

```bash
bun test test/engine/strategy/position-sizing.test.ts
git add -A && git commit -m "test: add position sizing tests for liquidity-adaptive scaling"
```

---

## Phase 3: Cross-Asset BTC Leading Indicator

**Why:** BTC price moves first, altcoins (SOL, DOGE, ETH) follow with 1-60s delay. Measured from our own data: median lag is 3 seconds. If BTC dumps 0.3% in 2 seconds, the SOL DOWN token will reprice from $0.50 to $0.85 within seconds — we can enter early at $0.60-$0.70 instead of $0.85.

**Architecture:** Add a secondary `TickerTracker` instance configured for BTC to each non-BTC bot. The strategy reads `btcTicker.price` alongside the asset's own ticker. When BTC makes a sharp move (>0.1% in <5s), the strategy enters the corresponding direction on the altcoin market early, before the certainty threshold is reached.

### Task 3.1: Add BTC ticker to StrategyContext

**Objective:** Make BTC price available to all strategies, regardless of which asset the bot trades.

**Files:**
- Modify: `engine/strategy/types.ts` — add `btcTicker?: TickerTracker` to `StrategyContext`
- Modify: `engine/early-bird.ts` — create secondary BTC ticker for non-BTC assets
- Modify: `engine/market-lifecycle.ts` — pass `btcTicker` through to strategy context

**Step 1: Add to StrategyContext type**

In `engine/strategy/types.ts`, add to the `StrategyContext` type:
```ts
btcTicker?: TickerTracker;  // BTC price feed for cross-asset signals (undefined for BTC bots)
```

**Step 2: Create BTC ticker in early-bird.ts**

In `EarlyBird.start()`, after the main ticker is created (around line 84):
```ts
// Create BTC ticker for cross-asset leading indicator (non-BTC bots only)
private _btcTicker?: TickerTracker;

// In start():
const asset = process.env.MARKET_ASSET ?? "unknown";
if (asset !== "btc") {
  this._btcTicker = new TickerTracker("btc");  // needs TickerTracker to accept asset override
  this._btcTicker.schedule();
  await this._btcTicker.waitForReady();
  log.write(`[startup] BTC cross-asset ticker ready`);
}
```

**Note:** `TickerTracker` currently reads `MARKET_ASSET` from env to determine which streams to connect. It needs a constructor parameter to override the asset. Check `tracker/ticker.ts` — the `schedule()` method uses `Env.getAssetConfig()`. We need to either:
- (a) Add a constructor param `assetOverride?: MarketAsset` to `TickerTracker`, or
- (b) Create a minimal BTC-only price tracker

Option (a) is cleaner. Modify `TickerTracker`:
```ts
class TickerTracker {
  private _assetOverride?: MarketAsset;

  constructor(assetOverride?: MarketAsset) {
    this._assetOverride = assetOverride;
  }

  private _getAssetConfig() {
    if (this._assetOverride) {
      return ASSET_TICKER_MAP[this._assetOverride];
    }
    return Env.getAssetConfig();
  }
  // ... replace all Env.getAssetConfig() calls with this._getAssetConfig()
}
```

**Step 3: Pass through MarketLifecycle to StrategyContext**

In `engine/market-lifecycle.ts`, in `_handleInit()` where `StrategyContext` is built (around line 291):
```ts
btcTicker: this._btcTicker,  // passed from EarlyBird
```

**Step 4: Write test, commit**

```bash
bun test
git add -A && git commit -m "feat: add BTC ticker feed to non-BTC strategy contexts"
```

### Task 3.2: Implement BTC momentum detector

**Objective:** Detect sharp BTC moves that predict altcoin direction.

**Files:**
- Create: `engine/strategy/btc-momentum.ts`
- Create: `test/engine/strategy/btc-momentum.test.ts`

**Step 1: Define the detector**

```ts
// engine/strategy/btc-momentum.ts

export interface BtcMomentumSignal {
  direction: "UP" | "DOWN";
  magnitude: number;      // percentage move (e.g. 0.003 = 0.3%)
  confidence: number;     // 0-1 based on move consistency
  ageMs: number;          // how long ago the move started
}

export class BtcMomentumDetector {
  private _prices: { ts: number; price: number }[] = [];
  private _windowMs: number;
  private _minMovePct: number;

  constructor(windowMs = 5000, minMovePct = 0.001) {
    this._windowMs = windowMs;     // look back 5 seconds
    this._minMovePct = minMovePct; // minimum 0.1% move to signal
  }

  /**
   * Feed a new BTC price tick. Call this every ~100ms from the strategy loop.
   */
  update(price: number, ts = Date.now()): void {
    this._prices.push({ ts, price });
    // Trim old entries
    const cutoff = ts - this._windowMs;
    while (this._prices.length > 0 && this._prices[0].ts < cutoff) {
      this._prices.shift();
    }
  }

  /**
   * Check if BTC has made a sharp directional move.
   * Returns null if no significant move detected.
   */
  detect(): BtcMomentumSignal | null {
    if (this._prices.length < 3) return null;

    const oldest = this._prices[0];
    const newest = this._prices[this._prices.length - 1];
    const movePct = (newest.price - oldest.price) / oldest.price;
    const absPct = Math.abs(movePct);

    if (absPct < this._minMovePct) return null;

    // Check consistency: are most intermediate ticks in the same direction?
    let consistent = 0;
    for (let i = 1; i < this._prices.length; i++) {
      const diff = this._prices[i].price - this._prices[i - 1].price;
      if ((movePct > 0 && diff > 0) || (movePct < 0 && diff < 0)) consistent++;
    }
    const confidence = consistent / (this._prices.length - 1);

    if (confidence < 0.6) return null; // noisy, not a clean move

    return {
      direction: movePct > 0 ? "UP" : "DOWN",
      magnitude: absPct,
      confidence,
      ageMs: newest.ts - oldest.ts,
    };
  }
}
```

**Step 2: Write tests**

```ts
// test/engine/strategy/btc-momentum.test.ts
import { describe, test, expect } from "bun:test";
import { BtcMomentumDetector } from "../../../engine/strategy/btc-momentum";

describe("BtcMomentumDetector", () => {
  test("detects sharp upward move", () => {
    const det = new BtcMomentumDetector(5000, 0.001);
    const base = 100000;
    // Simulate 0.3% rise over 3 seconds
    det.update(base, 1000);
    det.update(base * 1.001, 2000);
    det.update(base * 1.002, 3000);
    det.update(base * 1.003, 4000);

    const signal = det.detect();
    expect(signal).not.toBeNull();
    expect(signal!.direction).toBe("UP");
    expect(signal!.magnitude).toBeGreaterThan(0.001);
  });

  test("ignores small moves", () => {
    const det = new BtcMomentumDetector(5000, 0.001);
    det.update(100000, 1000);
    det.update(100005, 2000); // 0.005% — below threshold
    det.update(100008, 3000);

    expect(det.detect()).toBeNull();
  });

  test("ignores noisy/inconsistent moves", () => {
    const det = new BtcMomentumDetector(5000, 0.001);
    det.update(100000, 1000);
    det.update(100200, 2000); // up
    det.update(99900, 3000);  // down
    det.update(100300, 4000); // up — net up but inconsistent

    const signal = det.detect();
    // Should be null due to low consistency
    expect(signal).toBeNull();
  });

  test("expires old prices outside window", () => {
    const det = new BtcMomentumDetector(3000, 0.001);
    det.update(100000, 1000);
    det.update(100300, 2000);
    // Jump forward — old data should be trimmed
    det.update(100300, 10000);
    det.update(100301, 11000);

    const signal = det.detect();
    expect(signal).toBeNull(); // flat in recent window
  });
});
```

**Step 3: Run tests, commit**

```bash
bun test test/engine/strategy/btc-momentum.test.ts
git add -A && git commit -m "feat: add BTC momentum detector for cross-asset signals"
```

### Task 3.3: Integrate BTC momentum into late-entry strategy

**Objective:** Use BTC momentum as an early entry signal — when BTC moves sharply, enter the altcoin position before the certainty threshold is reached organically.

**Files:**
- Modify: `engine/strategy/late-entry.ts`

**Step 1: Add a second entry path using BTC momentum**

In the strategy's main loop (the `setInterval` at the bottom of `lateEntry`), add after the existing `checkEntry()` call:

```ts
// Existing path: certainty-based entry (price > 0.80)
const signal = checkEntry(entryParams, cfg);

// New path: BTC momentum early entry (non-BTC assets only)
if (!signal && ctx.btcTicker) {
  btcMomentum.update(ctx.btcTicker.price ?? 0);
  const momentum = btcMomentum.detect();

  if (momentum && remaining <= cfg.maxEntrySeconds) {
    // BTC moved sharply — check if altcoin market has a matching side
    // that hasn't repriced yet (price still < certaintyCutoff)
    const targetSide = momentum.direction;
    const info = targetSide === "UP"
      ? ctx.orderBook.bestAskInfo("UP")
      : ctx.orderBook.bestAskInfo("DOWN");

    if (
      info &&
      info.price > 0.55 &&                    // some directional signal exists
      info.price <= cfg.certaintyCutoff &&     // hasn't repriced to certainty yet (this is the edge)
      info.price <= cfg.maxEntryPrice &&
      info.liquidity >= cfg.minLiquidity
    ) {
      const earlySignal: EntrySignal = {
        side: targetSide,
        ask: info.price,
        gap: 0,
        liquidity: info.liquidity,
        stopLossPrice: Math.max(info.price - cfg.initialStopDistance, 0.01),
      };
      // Use smaller position for early entries (higher uncertainty)
      const earlyShares = Math.max(cfg.minShares, Math.floor(cfg.shares * momentum.confidence));
      placeEntry(ctx, state, earlySignal);
      // Log it distinctly
      ctx.log.write(`[btc-momentum] Early entry ${targetSide} @ ${info.price} (BTC ${momentum.direction} ${(momentum.magnitude * 100).toFixed(2)}%, conf ${momentum.confidence.toFixed(2)})`);
    }
  }
}
```

**Step 2: Initialize the detector in strategy setup**

At the top of the `lateEntry` strategy function:
```ts
const btcMomentum = new BtcMomentumDetector(5000, 0.001);
```

**Step 3: Run all tests**

```bash
bun test
```

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: integrate BTC momentum early entry for cross-asset trading"
```

---

## Phase 4: Integration Testing & Tuning

### Task 4.1: End-to-end test with FixtureRunner

**Objective:** Create a fixture-based integration test that replays real orderbook data and verifies the improved strategy behaves correctly.

**Files:**
- Create: `test/engine/strategy/late-entry-improved.test.ts`

**Step 1: Write integration tests**

Test scenarios:
1. **Price cap test:** Entry at $0.99 is rejected, entry at $0.96 is accepted
2. **Liquidity scaling test:** $25 liquidity → minShares, $100 liquidity → full shares
3. **Stop-loss test:** Entry at $0.90 → stop triggers at $0.80, trailing adjusts upward
4. **BTC momentum test:** BTC moves +0.3% → altcoin entry at $0.65 (before repricing to $0.85)

Use `FixtureRunner` from `test/engine/helpers/fixture-runner.ts` for realistic replay.

**Step 2: Run, iterate, commit**

```bash
bun test test/engine/strategy/late-entry-improved.test.ts
git add -A && git commit -m "test: add integration tests for improved late-entry strategy"
```

### Task 4.2: Git branch and PR

**Objective:** Create a feature branch, squash commits, open for review.

```bash
# If not already on a branch:
git checkout -b feat/strategy-improvements
# Cherry-pick or rebase all commits
git push origin feat/strategy-improvements
```

---

## Summary of All Changes

| Change | File(s) | Impact |
|--------|---------|--------|
| MAX_ENTRY_PRICE = 0.98 | `late-entry.ts` | Blocks terrible risk/reward entries |
| Per-asset config | `config.ts`, `late-entry.ts` | Different params per asset |
| Liquidity-adaptive sizing | `late-entry.ts` | Fewer shares on thin books → less slippage |
| BTC momentum detector | `btc-momentum.ts` (new) | Detects sharp BTC moves |
| BTC ticker on non-BTC bots | `early-bird.ts`, `ticker.ts`, `types.ts` | BTC price available everywhere |
| Cross-asset early entry | `late-entry.ts` | Enter altcoin before repricing |

## Parameter Reference

| Parameter | BTC | ETH | SOL | DOGE | Purpose |
|-----------|-----|-----|-----|------|---------|
| shares | 8 | 8 | 8 | 6 | Base position size |
| minShares | 4 | 4 | 3 | 3 | Floor on thin books |
| maxEntryPrice | 0.98 | 0.98 | 0.98 | 0.98 | Risk/reward cap |
| maxEntrySeconds | 120 | 120 | 120 | 120 | Entry window |
| initialStopDistance | 0.10 | 0.10 | 0.10 | 0.10 | Max loss/share |
| trailingStopDistance | 0.08 | 0.08 | 0.08 | 0.08 | Trailing stop |
| minLiquidity | 30 | 25 | 20 | 20 | Minimum book depth |
| liquidityFullSize | 100 | 80 | 60 | 40 | Full-size threshold |
| certaintyCutoff | 0.80 | 0.80 | 0.80 | 0.80 | Certainty threshold |

## Risks & Pitfalls

1. **BTC momentum false positives**: BTC may spike then reverse. The confidence filter (0.6) and smaller position size on early entries mitigate this, but monitor closely.
2. **TickerTracker dual instance**: Running two ticker WS connections per bot doubles the connections. Polymarket/Coinbase may rate-limit. Monitor for disconnects.
3. **Position sizing rounding**: `Math.round()` may produce 0 shares in edge cases. Always enforce `Math.max(minShares, ...)`.
4. **Test framework**: `bun:test` is used, NOT jest/vitest. Use `describe/test/expect` from `"bun:test"` and `sinon` for stubs.
5. **Imports**: The project uses `.ts` extensions in imports (e.g., `import { Env } from "../../utils/config"`). Some imports may need the extension depending on Bun resolution mode — check existing patterns.
6. **State file format**: Changes to position structure (e.g., adding fields) must be backward-compatible with existing `state/early-bird-prod-*.json` files.
