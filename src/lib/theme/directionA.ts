/**
 * Direction A — Celestial Atlas. Ink and gold leaf on warm paper.
 *
 * Single source for both CSS custom properties and three.js materials: a colour
 * defined twice drifts, and the canvas sitting a shade off the DOM around it is
 * the most visible way this treatment fails.
 *
 * Direction C (Zemí Stone, night) ships in R2 and is deliberately absent.
 */
export const DIRECTION_A = Object.freeze({
  ground: "#F7F6F2",
  ink: "#1B1A17",
  gold: "#B8860B",
  verdigris: "#0B6B4F",
  oxide: "#8C3B2E",
  /** Hairline rules, graticules, arm curves. */
  rule: "#D3CEC0",
  /** Arm dust and the deep field. Ink at low weight, not grey. */
  dust: "#1B1A17",
  /** Glass HUD ground. */
  hud: "#FFFFFF",
});

export type DirectionAToken = keyof typeof DIRECTION_A;
