import { describe, expect, it } from "vitest";
import { loadCatalogue, loadOwnerState, assertSupportedCatalogueVersion,
         UnsupportedCatalogueVersionError } from "../seed";

describe("seed loading", () => {
  it("loads the vendored 27-card catalogue", () => {
    expect(loadCatalogue().cards).toHaveLength(27);
  });

  it("loads owner state with a default card", () => {
    expect(loadOwnerState().defaultCardId).toBeTruthy();
  });

  it("accepts a supported MAJOR", () => {
    expect(() => assertSupportedCatalogueVersion("1.1")).not.toThrow();
    expect(() => assertSupportedCatalogueVersion("1.9")).not.toThrow();
  });

  it("refuses an unsupported MAJOR rather than coercing it", () => {
    expect(() => assertSupportedCatalogueVersion("2.0"))
      .toThrow(UnsupportedCatalogueVersionError);
    expect(() => assertSupportedCatalogueVersion("banana"))
      .toThrow(UnsupportedCatalogueVersionError);
  });
});
