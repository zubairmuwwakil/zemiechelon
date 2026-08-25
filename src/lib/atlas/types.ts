/** Arms are declared per scope, so this is a scope-keyed name rather than a closed set. */
export type ArmId = string;

/** e.g. "galaxy:zemi", "planet:products" */
export type ScopeId = string;

export interface Satellite {
  id: string;
  label: string;
  blurb: string;
}

export interface Body {
  id: string;
  label: string;
  parent: ScopeId;
  arm: ArmId;
  bornAt: string;
  lastTouchedAt: string;
  kind: "dwarfPlanet" | "moon";
  anonymous: boolean;
  blurb?: string;
  stack?: string[];
  links: { github?: string; live?: string; appStore?: string };
  satellites?: Satellite[];
  consoleId?: string;
  /** Editorial caption for a moment the timeline transport marks. Never a date or a count. */
  milestone?: string;
  /**
   * Seconds of finished runtime, for a body that is a recording rather than a
   * repository. Read by `magnitude`: a video is published once and never
   * touched, so its lifespan is zero by construction and cannot be the honest
   * signal that lifespan is for a repository. Absent for an idea, because
   * nothing has been made yet.
   */
  runtimeSeconds?: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface ScreenPoint {
  id: string;
  x: number;
  y: number;
  visible: boolean;
  depth: number;
}
