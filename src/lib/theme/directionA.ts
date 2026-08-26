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
  /**
   * Hairline rules, graticules, arm curves — on the night ground.
   *
   * This value only ever worked on obsidian, where it is ~13:1. On paper it is
   * ~1.45:1 before opacity and ~1.2:1 after, which is not a faint line, it is
   * an absent one. `ruleDay` is the same hairline drawn for the other ground;
   * `ruleFor` picks between them.
   */
  rule: "#D3CEC0",
  /** Hairline rules on paper. ~2.9:1 against `ground` — a drawn line, not a hint. */
  ruleDay: "#9A927E",
  /** Arm dust and the deep field. Ink at low weight, not grey. */
  dust: "#1B1A17",
  /** Glass HUD ground. */
  hud: "#FFFFFF",
});

export type DirectionAToken = keyof typeof DIRECTION_A;

/**
 * The hairline for a ground.
 *
 * Direction A already swaps the FIELD's role by mode — mark becomes paper,
 * paper becomes mark. The rules never got the same treatment and kept one
 * obsidian-tuned value on both grounds. Same idea, same place, one function so
 * the two builders cannot disagree about which line belongs to which ground.
 */
export function ruleFor(mode: "day" | "night"): string {
  return mode === "day" ? DIRECTION_A.ruleDay : DIRECTION_A.rule;
}
