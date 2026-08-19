"use client";

import {
  ArrowUpRight,
  CheckCircle2,
  Crosshair,
  FlaskConical,
  Globe,
  Mail,
  PenTool,
  Rocket,
  Sprout,
  User,
  X,
} from "lucide-react";
import { ARMS } from "@/data/arms";
import { FOUNDER_INFO } from "@/data/founder";
import { loadBodies } from "@/lib/atlas/bodies";
import type { ArmId, Body } from "@/lib/atlas/types";
import { GithubIcon } from "../icons/GithubIcon";

interface QuickDossierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectArmFromList: (armId: ArmId) => void;
  /** Select this body on the map. Wired to the deep-link hash by the page. */
  onSelectBody?: (bodyId: string) => void;
}

const ICONS_MAP: Record<string, React.ElementType> = {
  Sprout,
  Rocket,
  FlaskConical,
  User,
  PenTool,
};

// Grouped once at module load. The registry is static — it comes from committed
// repository metadata, not from anything that changes while the page is open.
const BODIES = loadBodies();

const LABELLED: Record<string, Body[]> = Object.fromEntries(
  ARMS.map((arm) => [
    arm.id,
    BODIES.filter((b) => b.arm === arm.id && !b.anonymous).sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "system" ? -1 : 1;
      return b.lastTouchedAt.localeCompare(a.lastTouchedAt);
    }),
  ]),
);

const PRIVATE_COUNT: Record<string, number> = Object.fromEntries(
  ARMS.map((arm) => [arm.id, BODIES.filter((b) => b.arm === arm.id && b.anonymous).length]),
);

export function QuickDossierModal({
  isOpen,
  onClose,
  onSelectArmFromList,
  onSelectBody,
}: QuickDossierModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-zinc-900/40 backdrop-blur-md p-4 sm:p-8 flex justify-center animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl rounded-3xl border border-zinc-200 bg-[#faf9f6] p-6 sm:p-10 shadow-2xl space-y-10 my-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 pb-6">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-mono text-zinc-700">
              <span>ZEMI ECHELON ARCHITECTURE DOSSIER</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900">
              System Holdings &amp; Engineering Registry
            </h1>
            <p className="text-xs sm:text-sm text-zinc-600 max-w-2xl leading-relaxed">
              Every charted body, in five arms — {BODIES.length} in total, of which{" "}
              {BODIES.filter((b) => b.anonymous).length} are private and appear on the atlas
              without a name.
            </p>
          </div>

          <button
            onClick={onClose}
            className="flex size-10 items-center justify-center rounded-2xl border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 shadow-xs transition-colors shrink-0"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Arm Breakdown */}
        <div className="space-y-12">
          {ARMS.map((arm) => {
            const IconComponent = ICONS_MAP[arm.icon] || Sprout;
            const bodies = LABELLED[arm.id] ?? [];
            const privateCount = PRIVATE_COUNT[arm.id] ?? 0;

            return (
              <section key={arm.id} className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-200/60 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="flex size-8 items-center justify-center rounded-xl border text-zinc-900"
                      style={{
                        backgroundColor: `${arm.themeColor}15`,
                        borderColor: `${arm.themeColor}30`,
                        color: arm.themeColor,
                      }}
                    >
                      <IconComponent className="size-4" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                        <span>{arm.name}</span>
                        <span className="text-xs font-mono text-zinc-600 font-normal">
                          · {arm.tagline}
                        </span>
                      </h2>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      onClose();
                      onSelectArmFromList(arm.id);
                    }}
                    className="inline-flex items-center gap-1 text-xs font-mono font-medium text-zinc-700 hover:text-zinc-900 self-start sm:self-auto"
                  >
                    <span>Open arm</span>
                    <ArrowUpRight className="size-3.5" />
                  </button>
                </div>

                {/* Cards Grid */}
                <div className="grid gap-4 sm:grid-cols-2">
                  {bodies.map((body) => (
                    <div
                      key={body.id}
                      className="flex flex-col justify-between rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-xs transition-all hover:border-zinc-300 hover:shadow-md"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="text-base font-bold text-zinc-900">
                              {body.label}
                            </h3>
                            <p className="text-xs font-mono text-zinc-600">
                              {body.id} · touched {body.lastTouchedAt}
                            </p>
                          </div>
                          {body.kind === "system" && (
                            <span className="rounded-full px-2.5 py-0.5 text-[10px] font-mono font-semibold border shrink-0 bg-amber-50 text-amber-700 border-amber-200">
                              SYSTEM
                            </span>
                          )}
                        </div>

                        {body.blurb && (
                          <p className="text-xs text-zinc-600 leading-relaxed">
                            {body.blurb}
                          </p>
                        )}

                        {body.satellites && body.satellites.length > 0 && (
                          <div className="space-y-1 pt-1">
                            {body.satellites.map((sat) => (
                              <div
                                key={sat.id}
                                className="flex items-start gap-1.5 text-[11px] text-zinc-600"
                              >
                                <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0 mt-0.5" />
                                <span>
                                  <span className="font-semibold text-zinc-700">
                                    {sat.label}
                                  </span>
                                  {" — "}
                                  {sat.blurb}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-zinc-100 flex flex-col gap-3">
                        {body.stack && body.stack.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {body.stack.map((item) => (
                              <span
                                key={item}
                                className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-mono text-zinc-600"
                              >
                                {item}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          {onSelectBody && (
                            <button
                              onClick={() => {
                                onClose();
                                onSelectBody(body.id);
                              }}
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
                              <span>Repository</span>
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {privateCount > 0 && (
                  <p className="text-[11px] font-mono text-zinc-500">
                    + {privateCount} private {privateCount === 1 ? "repository" : "repositories"}{" "}
                    charted in this arm without a name.
                  </p>
                )}
              </section>
            );
          })}
        </div>

        {/* Founder Bio Card */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-mono text-blue-700 mb-1.5">
                <span>FOUNDER &amp; PRINCIPAL ARCHITECT</span>
              </div>
              <h2 className="text-xl font-bold text-zinc-900">
                {FOUNDER_INFO.name}
              </h2>
              <p className="text-xs font-mono text-zinc-600">
                {FOUNDER_INFO.location} · {FOUNDER_INFO.company}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <a
                href={FOUNDER_INFO.links.portfolio}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-zinc-900 px-4 text-xs font-semibold text-white hover:bg-zinc-800 transition-colors"
              >
                <span>zubairmuwwakil.com</span>
                <ArrowUpRight className="size-3.5" />
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

          <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
            {FOUNDER_INFO.bio}
          </p>
        </div>
      </div>
    </div>
  );
}
