"use client";

import {
  ArrowUpRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Code2,
  ExternalLink,
  Globe,
  Layers,
  Mail,
  MapPin,
  Sparkles,
  Terminal,
  Trophy,
  X,
} from "lucide-react";
import { FOUNDER_INFO, SECTORS, SectorData } from "../data/ecosystem";
import { GithubIcon } from "../icons/GithubIcon";
import { PickleballMiniGame } from "./PickleballMiniGame";

interface SectorDrawerProps {
  selectedSectorId: string | null;
  onClose: () => void;
  onSelectSector: (sectorId: string) => void;
  onOpenTerminal?: () => void;
}

export function SectorDrawer({
  selectedSectorId,
  onClose,
  onSelectSector,
  onOpenTerminal,
}: SectorDrawerProps) {
  if (!selectedSectorId) return null;

  const currentSectorIndex = SECTORS.findIndex((s) => s.id === selectedSectorId);
  const sector = SECTORS[currentSectorIndex];
  if (!sector) return null;

  const handlePrev = () => {
    const prevIndex = (currentSectorIndex - 1 + SECTORS.length) % SECTORS.length;
    onSelectSector(SECTORS[prevIndex].id);
  };

  const handleNext = () => {
    const nextIndex = (currentSectorIndex + 1) % SECTORS.length;
    onSelectSector(SECTORS[nextIndex].id);
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
                  backgroundColor: `${sector.themeColor}12`,
                  borderColor: `${sector.themeColor}30`,
                  color: sector.themeColor,
                }}
              >
                <span
                  className="size-1.5 rounded-full"
                  style={{ backgroundColor: sector.themeColor }}
                />
                ZONE 0{currentSectorIndex + 1}
              </span>
              <span className="text-xs font-mono text-zinc-600">
                {sector.tagline}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900">
              {sector.name}
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-zinc-600 leading-relaxed max-w-xl">
              {sector.description}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handlePrev}
              className="flex size-8 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
              title="Previous zone"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              onClick={handleNext}
              className="flex size-8 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
              title="Next zone"
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

        {/* Playable Minigame for Sports Sector */}
        {sector.id === "sports" && (
          <div className="mt-5">
            <PickleballMiniGame />
          </div>
        )}

        {/* Command Quest Terminal Trigger for Intelligence Sector */}
        {sector.id === "intelligence" && onOpenTerminal && (
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

        {/* Founder Specific View */}
        {sector.id === "founder" ? (
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
        ) : (
          /* Project Cards List */
          <div className="mt-5 space-y-3.5">
            {sector.projects.map((proj) => (
              <div
                key={proj.id}
                className="group rounded-2xl border border-zinc-200/70 bg-zinc-50/70 p-4 sm:p-5 transition-all hover:bg-white hover:border-zinc-300 hover:shadow-md"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-zinc-900 group-hover:text-zinc-950">
                        {proj.name}
                      </h3>
                      {proj.badge && (
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-mono font-semibold border ${
                            proj.badgeColor === "emerald"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : proj.badgeColor === "sky"
                              ? "bg-sky-50 text-sky-700 border-sky-200"
                              : proj.badgeColor === "purple"
                              ? "bg-purple-50 text-purple-700 border-purple-200"
                              : proj.badgeColor === "orange"
                              ? "bg-orange-50 text-orange-700 border-orange-200"
                              : "bg-zinc-100 text-zinc-700 border-zinc-200"
                          }`}
                        >
                          {proj.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-mono text-zinc-600">
                      {proj.tagline}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-1 sm:pt-0">
                    {proj.liveUrl && (
                      <a
                        href={proj.liveUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-8 items-center gap-1 rounded-lg bg-zinc-900 px-3 text-xs font-semibold text-white shadow-xs hover:bg-zinc-800 transition-all"
                      >
                        <span>Live Site</span>
                        <ArrowUpRight className="size-3" />
                      </a>
                    )}
                    {proj.githubUrl && (
                      <a
                        href={proj.githubUrl}
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

                <p className="mt-2.5 text-xs text-zinc-600 leading-relaxed">
                  {proj.description}
                </p>

                {proj.features && proj.features.length > 0 && (
                  <div className="mt-3 space-y-1 border-t border-zinc-200/50 pt-2.5">
                    {proj.features.map((feat, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-1.5 text-[11px] text-zinc-600"
                      >
                        <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500 mt-0.5" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {proj.stack.map((item) => (
                    <span
                      key={item}
                      className="rounded-md border border-zinc-200/80 bg-white px-2 py-0.5 text-[10px] font-mono text-zinc-600"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
