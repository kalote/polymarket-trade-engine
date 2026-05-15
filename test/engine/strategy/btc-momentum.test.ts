import { describe, test, expect } from "bun:test";
import { BtcMomentumDetector } from "../../../engine/strategy/btc-momentum.ts";

describe("BtcMomentumDetector", () => {
  test("detects sharp upward move", () => {
    const det = new BtcMomentumDetector(5000, 0.001);
    const base = 100000;
    det.update(base, 1000);
    det.update(base * 1.001, 2000);
    det.update(base * 1.002, 3000);
    det.update(base * 1.003, 4000);

    const signal = det.detect();
    expect(signal).not.toBeNull();
    expect(signal!.direction).toBe("UP");
    expect(signal!.magnitude).toBeGreaterThan(0.001);
    expect(signal!.confidence).toBeGreaterThanOrEqual(0.6);
  });

  test("detects sharp downward move", () => {
    const det = new BtcMomentumDetector(5000, 0.001);
    const base = 100000;
    det.update(base, 1000);
    det.update(base * 0.999, 2000);
    det.update(base * 0.998, 3000);
    det.update(base * 0.997, 4000);

    const signal = det.detect();
    expect(signal).not.toBeNull();
    expect(signal!.direction).toBe("DOWN");
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
    det.update(99800, 3000);  // down
    det.update(99600, 3500);  // down
    det.update(100100, 4000); // up
    det.update(99700, 5000);  // down
    det.update(100150, 6000); // up — net up but very inconsistent

    const signal = det.detect();
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

  test("returns null with fewer than 3 data points", () => {
    const det = new BtcMomentumDetector(5000, 0.001);
    expect(det.detect()).toBeNull();
    det.update(100000, 1000);
    expect(det.detect()).toBeNull();
    det.update(100100, 2000);
    expect(det.detect()).toBeNull();
  });

  test("ageMs reflects time span of data", () => {
    const det = new BtcMomentumDetector(5000, 0.001);
    det.update(100000, 1000);
    det.update(100100, 2000);
    det.update(100200, 3000);
    det.update(100300, 4000);

    const signal = det.detect();
    expect(signal).not.toBeNull();
    expect(signal!.ageMs).toBe(3000); // 4000 - 1000
  });
});
