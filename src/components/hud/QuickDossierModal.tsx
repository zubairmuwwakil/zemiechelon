"use client";

import {
  ArrowUpRight,
  CheckCircle2,
  Coins,
  Cpu,
  Globe,
  Mail,
  MapPin,
  ShieldCheck,
  Trophy,
  User,
  X,
} from "lucide-react";
import { FOUNDER_INFO, SECTORS } from "../data/ecosystem";
import { GithubIcon } from "../icons/GithubIcon";

interface QuickDossierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSectorFromList: (sectorId: string) => void;
}

const ICONS_MAP: Record<string, React.ElementType> = {
  Coins,
  Cpu,
  Trophy,
  ShieldCheck,
  User,
};

export function QuickDossierModal({
  isOpen,
  onClose,
  onSelectSectorFromList,
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
              Complete index of software ventures, native mobile copilot systems, autonomous AI runtimes, and high-concurrency market infrastructure.
            </p>
          </div>

          <button
            onClick={onClose}
            className="flex size-10 items-center justify-center rounded-2xl border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 shadow-xs transition-colors shrink-0"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Sectors Breakdown */}
        <div className="space-y-12">
          {SECTORS.map((sector) => {
            const IconComponent = ICONS_MAP[sector.icon] || Coins;

            return (
              <section key={sector.id} className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-200/60 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="flex size-8 items-center justify-center rounded-xl border text-zinc-900"
                      style={{
                        backgroundColor: `${sector.themeColor}15`,
                        borderColor: `${sector.themeColor}30`,
                        color: sector.themeColor,
                      }}
                    >
                      <IconComponent className="size-4" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                        <span>{sector.name}</span>
                        <span className="text-xs font-mono text-zinc-600 font-normal">
                          · {sector.tagline}
                        </span>
                      </h2>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      onClose();
                      onSelectSectorFromList(sector.id);
                    }}
                    className="inline-flex items-center gap-1 text-xs font-mono font-medium text-zinc-700 hover:text-zinc-900 self-start sm:self-auto"
                  >
                    <span>View in 3D Map</span>
                    <ArrowUpRight className="size-3.5" />
                  </button>
                </div>

                {/* Cards Grid */}
                <div className="grid gap-4 sm:grid-cols-2">
                  {sector.projects.map((proj) => (
                    <div
                      key={proj.id}
                      className="flex flex-col justify-between rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-xs transition-all hover:border-zinc-300 hover:shadow-md"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="text-base font-bold text-zinc-900">
                              {proj.name}
                            </h3>
                            <p className="text-xs font-mono text-zinc-600">
                              {proj.tagline}
                            </p>
                          </div>
                          {proj.badge && (
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-mono font-semibold border shrink-0 ${
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

                        <p className="text-xs text-zinc-600 leading-relaxed">
                          {proj.description}
                        </p>

                        {proj.features && (
                          <div className="space-y-1 pt-1">
                            {proj.features.map((feat, idx) => (
                              <div
                                key={idx}
                                className="flex items-start gap-1.5 text-[11px] text-zinc-600"
                              >
                                <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0 mt-0.5" />
                                <span>{feat}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-zinc-100 flex flex-col gap-3">
                        <div className="flex flex-wrap gap-1">
                          {proj.stack.map((item) => (
                            <span
                              key={item}
                              className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-mono text-zinc-600"
                            >
                              {item}
                            </span>
                          ))}
                        </div>

                        <div className="flex items-center gap-2">
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
                              <span>Repository</span>
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
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
