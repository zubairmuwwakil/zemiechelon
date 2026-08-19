/**
 * Replaces `Loading/SeedLoader.swift`.
 *
 * Swift reads its seed data from `Bundle.module`; a browser bundle has no bundle and no
 * filesystem, so the JSON is imported directly and inlined by the bundler at build time.
 * That is the one intentional structural difference between this file and the Swift. The
 * version guard it wraps is ported faithfully, because refusing an unrecognised MAJOR is
 * the whole point of the loader.
 */

import catalogueJson from "@/data/contracts/card-catalogue.json";
import ownerStateJson from "@/data/contracts/owner-state.json";
import type { Catalogue } from "./catalogue";
import type { OwnerState } from "./ownerState";

/** The only catalogueVersion MAJOR this build understands. See ../PickMe/contracts/CHANGELOG.md. */
const SUPPORTED_CATALOGUE_MAJOR = 1;

export class UnsupportedCatalogueVersionError extends Error {
  constructor(version: string) {
    super(`unsupported catalogueVersion: ${version}`);
    this.name = "UnsupportedCatalogueVersionError";
  }
}

/**
 * `catalogueVersion` is "MAJOR.MINOR". Refuses a MAJOR this build does not recognise rather
 * than silently misinterpreting a breaking shape change — `SeedLoader.validate(catalogueVersion:)`.
 *
 * Deliberately not `Number.parseInt`: Swift's `Int("1abc")` is `nil` and therefore refused,
 * whereas `parseInt("1abc")` is `1` and would be waved through. `Number("1abc")` is `NaN`,
 * which matches Swift. A guard that accepts malformed input is not a guard.
 */
export function assertSupportedCatalogueVersion(version: string): void {
  const major = Number(version.split(".", 1)[0]);
  if (!Number.isInteger(major) || major !== SUPPORTED_CATALOGUE_MAJOR) {
    throw new UnsupportedCatalogueVersionError(version);
  }
}

export function loadCatalogue(): Catalogue {
  const c = catalogueJson as unknown as Catalogue;
  assertSupportedCatalogueVersion(c.catalogueVersion);
  return c;
}

export function loadOwnerState(): OwnerState {
  return ownerStateJson as unknown as OwnerState;
}
