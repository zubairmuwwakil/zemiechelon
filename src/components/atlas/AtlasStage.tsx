"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadBodies } from "@/lib/atlas/bodies";
import { bodyIdToHash, hashToBodyId } from "@/lib/atlas/deepLink";
import type { ScreenPoint } from "@/lib/atlas/types";
import { sound } from "@/lib/audio";
import { BodyCard } from "./BodyCard";
import { Chart } from "./Chart";
import { Field } from "./Field";

export interface AtlasStageProps {
  /**
   * Bump to deselect and swing the camera back to the overview. The HUD's reset
   * button owns this; it is a token rather than a callback because the caller
   * has no handle on the camera and should not acquire one.
   */
  resetToken?: number;
}

/** The camera's opening distance, and the fallback until the first frame lands. */
const OVERVIEW_DISTANCE = 58;

interface Projection {
  points: ScreenPoint[];
  cameraDistance: number;
}

/**
 * The whole shell: the WebGL Field underneath, the DOM Chart of hit targets over
 * it, and the BodyCard on top. Owns selection, the projection the Chart is
 * positioned by, and the URL hash.
 *
 * The hash is deliberately the selection bus rather than a side effect of it. A
 * pasted link, the browser's back button and the dossier's locate buttons then
 * all reach a body through one path, and nothing outside this component needs a
 * handle on the camera to move it.
 */
export function AtlasStage({ resetToken = 0 }: AtlasStageProps) {
  const bodies = useMemo(() => loadBodies(), []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [projection, setProjection] = useState<Projection>({
    points: [],
    cameraDistance: OVERVIEW_DISTANCE,
  });

  useEffect(() => {
    const sync = () => setSelectedId(hashToBodyId(window.location.hash, bodies));
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [bodies]);

  const handleProject = useCallback(
    (points: ScreenPoint[], cameraDistance = OVERVIEW_DISTANCE) => {
      setProjection({ points, cameraDistance });
    },
    [],
  );

  const handleSelect = useCallback((bodyId: string) => {
    sound.playClick(600, 0.05);
    setSelectedId(bodyId);
    window.location.hash = bodyIdToHash(bodyId);
  }, []);

  const handleClose = useCallback(() => {
    setSelectedId(null);
    // replaceState rather than `location.hash = ""`, which leaves a bare "#" in
    // the address bar and spends a history entry on closing a card.
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }, []);

  // Reset deselects as well as recentring: a card left open over an overview the
  // user just asked for would contradict both the view and the URL. Skipped on
  // the first run, which would otherwise close a card opened from a deep link.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    handleClose();
  }, [resetToken, handleClose]);

  const selected = useMemo(
    () => (selectedId ? bodies.find((b) => b.id === selectedId) ?? null : null),
    [bodies, selectedId],
  );

  // Held by identity. A projection arrives every frame; without this the Field —
  // which owns the WebGL context and the render loop — would re-render 60 times
  // a second alongside the Chart that actually needs the new points.
  const field = useMemo(
    () => (
      <Field
        bodies={bodies}
        selectedId={selectedId}
        resetToken={resetToken}
        onProject={handleProject}
      />
    ),
    [bodies, selectedId, resetToken, handleProject],
  );

  return (
    <div className="absolute inset-0">
      {field}
      <Chart
        bodies={bodies}
        points={projection.points}
        cameraDistance={projection.cameraDistance}
        selectedId={selectedId}
        onSelect={handleSelect}
      />
      {selected && <BodyCard body={selected} onClose={handleClose} />}
    </div>
  );
}
