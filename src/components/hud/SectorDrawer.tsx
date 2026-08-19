"use client";

import { useMemo } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Globe,
  Mail,
  MapPin,
  Terminal,
  X,
} from "lucide-react";
import { ARMS } from "@/data/arms";
import { FOUNDER_INFO } from "@/data/founder";
import { loadBodies } from "@/lib/atlas/bodies";
import type { ArmId, Body } from "@/lib/atlas/types";
import { GithubIcon } from "../icons/GithubIcon";
import { PickleballMiniGame } from "./PickleballMiniGame";

interface SectorDrawerProps {
  selectedArmId: ArmId | null;
  onClose: () => void;
  onSelectArm: (armId: ArmId) => void;
  /** Select this body on the map. Wired to the deep-link hash by the page. */
  onSelectBody?: (bodyId: string) => void;
  onOpenTerminal?: () => void;
}

const BODIES = loadBodies();

/**
 * Systems first, then most recently touched. The old drawer's order was authored
 * per project; there is nothing left to author it with, and "still alive" is the
 * ordering a reader actually wants.
 */
function inArm(armId: ArmId): Body[] {
  return BODIES.filter((b) => b.arm === armId && !b.anonymous).sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "system" ? -1 : 1;
    return b.lastTouchedAt.localeCompare(a.lastTouchedAt);
  });
}

export function SectorDrawer({
  selectedArmId,
  onClose,
  onSelectArm,
  onSelectBody,
  onOpenTerminal,
}: SectorDrawerProps) {
  const armIndex = ARMS.findIndex((a) => a.id === selectedArmId);
  const arm = armIndex >= 0 ? ARMS[armIndex] : null;

  const bodies = useMemo(() => (arm ? inArm(arm.id) : []), [arm]);
  const privateCount = useMemo(
    () => (arm ? BODIES.filter((b) => b.arm === arm.id && b.anonymous).length : 0),
    [arm],
  );

  if (!arm) return null;

  const handlePrev = () => {
    onSelectArm(ARMS[(armIndex - 1 + ARMS.length) % ARMS.length].id);
  };

  const handleNext = () => {
    onSelectArm(ARMS[(armIndex + 1) % ARMS.length].id);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 p-3 sm:p-6 flex justify-center pointer-events-none animate-in fade-in slide-in-from-bottom-6 duration-300">
      <div className="pointer-events-auto w-full max-w-3xl max-h-[82vh] overflow-y-auto rounded-3xl border border-zinc-200/80 bg-white/95 p-5 sm:p-7 shadow-2xl backdrop-blur-xl transition-all">
        {/* Header Bar */}
        <div className="flex items-start justify-between gap-4 border-b border-zinc-100 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-mono font-medium border"
                style={{
                  backgroundColor: `${arm.themeColor}12`,
                  borderColor: `${arm.themeColor}30`,
                  color: arm.themeColor,
                }}
              >
                <span
                  className="size-1.5 rounded-full"
                  style={{ backgroundColor: arm.themeColor }}
                />
                ARM 0{armIndex + 1}
              </span>
              <span className="text-xs font-mono text-zinc-600">
                {arm.tagline}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900">
              {arm.name}
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-zinc-600 leading-relaxed max-w-xl">
              {arm.description}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handlePrev}
              className="flex size-8 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
              title="Previous arm"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              onClick={handleNext}
              className="flex size-8 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
              title="Next arm"
            >
              <ChevronRight className="size-4" />
            </button>
            <button
              onClick={onClose}
              className="flex size-8 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition-colors ml-1"
              title="Close drawer"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Playable Minigame — the pickleball stack lives in this arm */}
        {arm.id === "products" && (
          <div className="mt-5">
            <PickleballMiniGame />
          </div>
        )}

        {/* Command Quest Terminal Trigger — CommandQuest lives in this arm */}
        {arm.id === "labs" && onOpenTerminal && (
          <div className="mt-5 flex items-center justify-between rounded-2xl border border-purple-200 bg-purple-50/60 p-4">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-xl bg-purple-600 text-white shadow-xs">
                <Terminal className="size-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-purple-950 uppercase tracking-wider">
                  Command Quest Retro Terminal
                </h4>
                <p className="text-[11px] font-mono text-purple-700">
                  Interactive CLI shell simulator
                </p>
              </div>
            </div>
            <button
              onClick={onOpenTerminal}
              className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-purple-600 px-3 text-xs font-bold text-white shadow-xs hover:bg-purple-700 transition-colors"
            >
              <span>Open Terminal</span>
              <ArrowUpRight className="size-3" />
            </button>
          </div>
        )}

        {/* Founder panel for the Self arm */}
        {arm.id === "self" && (
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50/80 p-5 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-zinc-900">
                    {FOUNDER_INFO.name}
                  </h3>
                  <p className="text-xs font-mono text-blue-600">
                    {FOUNDER_INFO.role} · {FOUNDER_INFO.company}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-mono text-zinc-600">
                  <MapPin className="size-3.5 text-zinc-400" />
                  <span>{FOUNDER_INFO.location}</span>
                </div>
              </div>

              <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
                {FOUNDER_INFO.bio}
              </p>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {FOUNDER_INFO.skills.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-mono text-zinc-700"
                  >
                    {skill}
                  </span>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2.5 pt-3 border-t border-zinc-200/60">
                <a
                  href={FOUNDER_INFO.links.portfolio}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-zinc-900 px-4 text-xs font-semibold text-white shadow-sm hover:bg-zinc-800 transition-colors"
                >
                  <span>Visit zubairmuwwakil.com</span>
                  <ArrowUpRight className="size-3.5" />
                </a>
                <a
                  href={FOUNDER_INFO.links.github}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors"
                >
                  <GithubIcon className="size-3.5" />
                  <span>GitHub</span>
                </a>
                <a
                  href={FOUNDER_INFO.links.linkedin}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors"
                >
                  <Globe className="size-3.5" />
                  <span>LinkedIn</span>
                </a>
                <a
                  href={`mailto:${FOUNDER_INFO.links.email}`}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors"
                >
                  <Mail className="size-3.5" />
                  <span>Email</span>
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Body Cards List */}
        <div className="mt-5 space-y-3.5">
          {bodies.map((body) => (
            <div
              key={body.id}
              className="group rounded-2xl border border-zinc-200/70 bg-zinc-50/70 p-4 sm:p-5 transition-all hover:bg-white hover:border-zinc-300 hover:shadow-md"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-zinc-900 group-hover:text-zinc-950">
                      {body.label}
                    </h3>
                    {body.kind === "system" && (
                      <span className="rounded-full px-2.5 py-0.5 text-[10px] font-mono font-semibold border bg-amber-50 text-amber-700 border-amber-200">
                        SYSTEM
                      </span>
                    )}
                    {body.links.live && (
                      <span className="rounded-full px-2.5 py-0.5 text-[10px] font-mono font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
                        LIVE
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-mono text-zinc-600">
                    {body.id} · formed {body.bornAt} · touched {body.lastTouchedAt}
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-1 sm:pt-0">
                  {onSelectBody && (
                    <button
                      onClick={() => onSelectBody(body.id)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 transition-all"
                      title={`Find ${body.label} on the atlas`}
                    >
                      <Crosshair className="size-3" />
                      <span>Locate</span>
                    </button>
                  )}
                  {body.links.live && (
                    <a
                      href={body.links.live}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-8 items-center gap-1 rounded-lg bg-zinc-900 px-3 text-xs font-semibold text-white shadow-xs hover:bg-zinc-800 transition-all"
                    >
                      <span>Live Site</span>
                      <ArrowUpRight className="size-3" />
                    </a>
                  )}
                  {body.links.github && (
                    <a
                      href={body.links.github}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 transition-all"
                    >
                      <GithubIcon className="size-3" />
                      <span>Code</span>
                    </a>
                  )}
                </div>
              </div>

              {body.blurb && (
                <p className="mt-2.5 text-xs text-zinc-600 leading-relaxed">
                  {body.blurb}
                </p>
              )}

              {body.satellites && body.satellites.length > 0 && (
                <div className="mt-3 space-y-1 border-t border-zinc-200/50 pt-2.5">
                  {body.satellites.map((sat) => (
                    <div
                      key={sat.id}
                      className="flex items-start gap-1.5 text-[11px] text-zinc-600"
                    >
                      <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500 mt-0.5" />
                      <span>
                        <span className="font-semibold text-zinc-700">{sat.label}</span>
                        {" — "}
                        {sat.blurb}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {body.stack && body.stack.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {body.stack.map((item) => (
                    <span
                      key={item}
                      className="rounded-md border border-zinc-200/80 bg-white px-2 py-0.5 text-[10px] font-mono text-zinc-600"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}

          {privateCount > 0 && (
            <p className="pt-1 text-[11px] font-mono text-zinc-500">
              + {privateCount} private {privateCount === 1 ? "repository" : "repositories"} in
              this arm, charted but unnamed.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
