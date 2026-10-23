import { describe, expect, it } from "vitest";

import { AmountError, formatUnits, parseU128, parseUnits } from "../src/amount.js";

describe("parseUnits", () => {
  it("converts exactly", () => {
    expect(parseUnits("0", 6)).toBe(0n);
    expect(parseUnits("3", 6)).toBe(3_000_000n);
    expect(parseUnits("12.5", 6)).toBe(12_500_000n);
    expect(parseUnits("0.000001", 6)).toBe(1n);
    expect(parseUnits("7", 0)).toBe(7n);
  });

  it("rejects anything that is not a plain decimal or would need rounding", () => {
    for (const bad of ["", " 1", "1 ", "-1", "+1", "1e3", "0x10", "1.", ".5", "01", "1,5", "NaN", "Infinity"]) {
      expect(() => parseUnits(bad, 6), bad).toThrow(AmountError);
    }
    expect(() => parseUnits("0.0000001", 6)).toThrow(/rounding/);
    expect(() => parseUnits("1", 25)).toThrow(AmountError);
    expect(() => parseUnits("1", 1.5)).toThrow(AmountError);
    expect(() => parseUnits("340282366920938463463374607431768211456", 0)).toThrow(/u128/);
  });
});

describe("formatUnits", () => {
  it("round-trips", () => {
    for (const s of ["0", "1", "12.5", "0.000001", "1000000"]) {
      expect(formatUnits(parseUnits(s, 6), 6)).toBe(s);
    }
    expect(formatUnits(5n, 0)).toBe("5");
  });

  it("rejects out-of-range units", () => {
    expect(() => formatUnits(-1n, 6)).toThrow(AmountError);
  });
});

describe("parseU128", () => {
  it("accepts only canonical integer strings", () => {
    expect(parseU128("0")).toBe(0n);
    expect(parseU128("340282366920938463463374607431768211455")).toBe((1n << 128n) - 1n);
    for (const bad of ["", "-1", "01", "1.0", " 1", "340282366920938463463374607431768211456"]) {
      expect(() => parseU128(bad), bad).toThrow(AmountError);
    }
  });
});
