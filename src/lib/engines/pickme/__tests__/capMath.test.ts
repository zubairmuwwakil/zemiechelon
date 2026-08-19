import { describe, expect, it } from "vitest";
import { splitAtCap } from "../capMath";

describe("splitAtCap", () => {
  it("puts the whole amount in-cap when there is room", () => {
    expect(splitAtCap(100, 1000, 0)).toEqual({ inCap: 100, overCap: 0 });
  });

  it("splits across the cap boundary", () => {
    expect(splitAtCap(100, 1000, 950)).toEqual({ inCap: 50, overCap: 50 });
  });

  it("puts the whole amount over-cap when the cap is exactly met", () => {
    expect(splitAtCap(100, 1000, 1000)).toEqual({ inCap: 0, overCap: 100 });
  });

  it("clamps negative room to zero when usage exceeds the limit", () => {
    expect(splitAtCap(100, 1000, 1200)).toEqual({ inCap: 0, overCap: 100 });
  });

  it("handles a zero amount without producing negative parts", () => {
    expect(splitAtCap(0, 1000, 500)).toEqual({ inCap: 0, overCap: 0 });
  });
});
