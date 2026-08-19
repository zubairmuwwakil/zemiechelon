/**
 * The package's only public surface — the import boundary Track C's console consumes.
 *
 * Everything not re-exported here is internal and may change without notice: `score`,
 * `resolveRule`, `activeFxRule`, `splitAtCap`, `decodeEarn`, the `Explainer` helpers, the
 * `RecommendationEngine` class, and `assertSupportedCatalogueVersion`. The last of those is
 * deliberately withheld — callers get the version guard by going through `loadCatalogue`,
 * never by validating a version themselves and deciding what to do about it.
 *
 * `__tests__/publicSurface.test.ts` pins the runtime key list, so widening this file is a
 * conscious act rather than a drive-by import.
 */

export { recommend } from "./recommendationEngine";
export { makePurchase } from "./purchase";
export { loadCatalogue, loadOwnerState, UnsupportedCatalogueVersionError } from "./seed";

export type { Recommendation, ValuationDirection } from "./recommendationEngine";
export type { CandidateScore, Warning } from "./scorer";
export type { PurchaseContext } from "./purchase";
export type { Catalogue, CardProduct, Earn, Network } from "./catalogue";
export type { OwnerState, Valuations, PointValuation } from "./ownerState";
