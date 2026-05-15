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
