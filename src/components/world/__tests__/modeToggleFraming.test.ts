import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Toggling the ground must not rebuild the world.
 *
 * This is asserted against the SOURCE rather than against a running component,
 * and that is a deliberate compromise rather than an oversight: `WorldCanvas`
 * opens a real `WebGLRenderer` on mount, jsdom has no WebGL, and nothing in
 * this suite renders it. Mocking enough of three.js to mount it would leave the
 * test asserting against a fiction of the renderer rather than against the
 * scene. What actually went wrong here is expressible without any of that — a
 * dependency array named a value it did not need — so that is what is guarded.
 *
 * The bug: `cosmicMode` sat in the scene-construction effect's dependencies
 * from a time when a rebuild was the only way to repaint the builders. Once
 * `builder.setCosmicMode` existed, a dedicated effect repainted the live scene
 * and the rebuild became redundant — but the dependency stayed, so every toggle
 * tore down the renderer, the composer and the camera manager. A visitor
 * standing on a surface was returned to the default pose and made to sit
 * through the whole descent again to get back to where they already were.
 */
const SOURCE = readFileSync(
  resolve(__dirname, "../WorldCanvas.tsx"),
  "utf8",
);

/** Every `}, [ … ]);` in the file: one dependency array per `useEffect`. */
function dependencyArrays(): string[] {
  return [...SOURCE.matchAll(/\}, \[([\s\S]*?)\]\);/g)].map((match) => match[1]);
}

/** The identifiers in one dependency array, with its explanatory comments stripped. */
function dependencies(block: string): string[] {
  return block
    .replace(/\/\/[^\n]*/g, "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

describe("the ground swaps without rebuilding the world", () => {
  it("does not rebuild the scene when the mode changes", () => {
    // The scene-construction effect, named by a dependency only it has.
    const construction = dependencyArrays().find((block) => block.includes("onSelectSector"));
    expect(construction, "no scene-construction effect found in WorldCanvas").toBeDefined();

    // Rebuilding is what loses the camera: the effect constructs a fresh
    // `WorldCameraManager`, so the pose a standing visitor was in is gone and
    // re-applying the framing flies the descent from the default pose.
    expect(dependencies(construction!)).not.toContain("cosmicMode");
  });

  it("still delivers the mode to the live scene", () => {
    // The other way to make the test above pass is to stop repainting on a
    // toggle at all, which would leave the night ground drawn in day colours.
    const live = dependencyArrays().find((block) => dependencies(block).includes("cosmicMode"));
    expect(live, "nothing in WorldCanvas reacts to the mode any more").toBeDefined();

    const effect = SOURCE.slice(0, SOURCE.indexOf(`}, [${live}]);`));
    for (const call of [
      "builder.setCosmicMode(cosmicMode)",
      "galaxyBuilderRef.current?.setCosmicMode(cosmicMode)",
      "dayNightRef.current?.setMode(cosmicMode)",
    ]) {
      expect(effect, `the live path stopped calling ${call}`).toContain(call);
    }
  });
});
