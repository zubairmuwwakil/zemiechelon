/**
 * The consoleIds that have a real engine behind them.
 *
 * This is what separates a console from a mockup, and therefore what separates
 * a landing from a flyby: spec §3.3 gives a surface only where the evidence to
 * stand on already exists. Inunity carries a `consoleId` too, and gets a flyby,
 * because nothing ships underneath it yet.
 *
 * A hand-kept list would go stale the moment a second engine landed, so
 * `surfaces.test.ts` asserts this set equals the directories on disk. Adding an
 * engine and forgetting this file fails CI rather than quietly withholding a
 * surface the work has earned.
 */
export const ENGINE_IDS: ReadonlySet<string> = new Set(["pickme"]);
