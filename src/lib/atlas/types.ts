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
  kind: "star" | "system";
  anonymous: boolean;
  blurb?: string;
  stack?: string[];
  links: { github?: string; live?: string; appStore?: string };
  satellites?: Satellite[];
  consoleId?: string;
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
