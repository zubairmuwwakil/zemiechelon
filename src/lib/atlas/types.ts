export type ArmId = "foundations" | "products" | "labs" | "self" | "creative";

export interface Satellite {
  id: string;
  label: string;
  blurb: string;
}

export interface Body {
  id: string;
  label: string;
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
