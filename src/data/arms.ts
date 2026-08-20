import type { ArmId } from "@/lib/atlas/types";
import { DIRECTION_A } from "@/lib/theme/directionA";

/**
 * Presentation copy for the five arms — the only editorial input the HUD needs.
 * Bodies come from `loadBodies()`; nothing here describes a repository, and
 * nothing here is a coordinate. Order matches `ARM_ANGLES` so the navigation
 * dock reads in the same order the arms wind out of the core.
 */
export interface ArmMeta {
  id: ArmId;
  name: string;
  shortName: string;
  /** lucide-react icon name, resolved through each HUD component's icon map. */
  icon: string;
  tagline: string;
  description: string;
  /**
   * Must equal the arm's `SURFACE_FAMILIES[arm].baseColor`, so the HUD dot and
   * the planet it points at are the same colour. The token is read from
   * `DIRECTION_A` rather than from `PlanetSurfaces`, which would pull three.js
   * into the data layer; `planetSurfaces.test.ts` holds the two in step.
   */
  themeColor: string;
}

export const ARMS: ArmMeta[] = [
  {
    id: "foundations",
    name: "Foundations",
    shortName: "Foundations",
    icon: "Sprout",
    tagline: "Where the craft was learned",
    description:
      "The oldest and densest arm: language practice, algorithm drills and first web builds. Nineteen bodies packed around the core, most of them long cold — the sediment everything later stands on.",
    themeColor: DIRECTION_A.ink,
  },
  {
    id: "products",
    name: "Products",
    shortName: "Products",
    icon: "Rocket",
    tagline: "Shipped, running, and used",
    description:
      "Software with users behind it: the Inunity financial continuum, an entirely offline iOS card copilot, a high-concurrency market data pipeline, and the pickleball operations stack.",
    themeColor: DIRECTION_A.gold,
  },
  {
    id: "labs",
    name: "Labs",
    shortName: "Labs",
    icon: "FlaskConical",
    tagline: "Autonomy and developer infrastructure",
    description:
      "Multi-agent runtimes, graph tooling and CLI experiments. Work that exists to answer whether a thing can be built at all, not yet whether anyone wants it.",
    themeColor: DIRECTION_A.oxide,
  },
  {
    id: "self",
    name: "Self",
    shortName: "Self",
    icon: "User",
    tagline: "Zubair Muwwakil — Principal Architect",
    description:
      "The portfolio sites, this atlas, and the public surface of Zemí Echelon. The arm that points at the person rather than the product.",
    themeColor: DIRECTION_A.verdigris,
  },
  {
    id: "creative",
    name: "Creative",
    shortName: "Creative",
    icon: "PenTool",
    tagline: "Written down rather than built",
    description:
      "The smallest arm — two bodies, one of them private. Notes, longform and the vault that never became a product.",
    themeColor: DIRECTION_A.oxide,
  },
];

export const ARM_META: Record<ArmId, ArmMeta> = Object.fromEntries(
  ARMS.map((a) => [a.id, a]),
) as Record<ArmId, ArmMeta>;
