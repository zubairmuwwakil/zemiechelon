"use client";

import { useEffect, useRef } from "react";
import { ArrowUpRight, Calendar, Layers, Terminal, X } from "lucide-react";
import type { Body } from "@/lib/atlas/types";
import { GithubIcon } from "@/components/icons/GithubIcon";

export interface BodyCardProps {
  body: Body;
  onClose: () => void;
}

export function BodyCard({ body, onClose }: BodyCardProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // Save previously focused element to restore on close
    previousActiveElementRef.current = document.activeElement as HTMLElement | null;

    // Focus panel on open
    panelRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      // Restore focus on close
      previousActiveElementRef.current?.focus?.();
    };
  }, [onClose]);

  const hasSatellites = body.satellites && body.satellites.length > 0;

  return (
    <div
      data-testid="body-card-backdrop"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-zinc-900/30 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={body.label}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="glass-panel-light relative w-full max-w-lg rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 focus:outline-hidden max-h-[90vh] overflow-y-auto"
      >
        {/* Header: Arm/Kind badge, Label, Close button */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-mono font-medium border ${
                  body.kind === "moon"
                    ? "bg-amber-50 text-amber-800 border-amber-200"
                    : "bg-zinc-100 text-zinc-700 border-zinc-200"
                }`}
              >
                {body.kind === "moon" && (
                  <span className="size-1.5 rounded-full bg-amber-500" aria-hidden="true" />
                )}
                <span className="capitalize">{body.kind}</span> · {body.arm}
              </span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900">
              {body.label}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 items-center justify-center rounded-xl border border-zinc-200 bg-white/80 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 shadow-xs transition-colors shrink-0"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Blurb */}
        {body.blurb && (
          <p className="text-sm text-zinc-600 leading-relaxed">
            {body.blurb}
          </p>
        )}

        {/* Dates */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-zinc-500 py-1.5 border-y border-zinc-200/60">
          <div className="flex items-center gap-1.5">
            <Calendar className="size-3.5 text-zinc-400" />
            <span>Formed: {body.bornAt}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            <span>Touched: {body.lastTouchedAt}</span>
          </div>
        </div>

        {/* Satellites for Systems */}
        {hasSatellites && (
          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-mono font-semibold uppercase tracking-wider text-zinc-500">
              <Layers className="size-3.5 text-zinc-400" />
              <span>Satellites ({body.satellites!.length})</span>
            </div>
            <ul role="list" className="space-y-2">
              {body.satellites!.map((sat) => (
                <li
                  key={sat.id}
                  className="rounded-xl border border-zinc-200/80 bg-white/60 p-3 shadow-2xs"
                >
                  <div className="text-xs font-bold text-zinc-900">{sat.label}</div>
                  <div className="text-xs text-zinc-600 mt-0.5">{sat.blurb}</div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Stack chips */}
        {body.stack && body.stack.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-500">
              Stack
            </div>
            <div className="flex flex-wrap gap-1.5">
              {body.stack.map((tech) => (
                <span
                  key={tech}
                  className="rounded-md border border-zinc-200 bg-white/80 px-2 py-0.5 text-[11px] font-mono text-zinc-700"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Action buttons / Links / Console mount point */}
        <div className="pt-2 flex flex-wrap items-center gap-2.5">
          {body.links.github && (
            <a
              href={body.links.github}
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub repository"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 hover:text-zinc-900 transition-colors shadow-xs"
            >
              <GithubIcon className="size-3.5" />
              <span>GitHub</span>
              <ArrowUpRight className="size-3 text-zinc-400" />
            </a>
          )}

          {body.links.live && (
            <a
              href={body.links.live}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-zinc-900 px-3.5 text-xs font-semibold text-white hover:bg-zinc-800 transition-colors shadow-xs"
            >
              <span>Live Site</span>
              <ArrowUpRight className="size-3.5" />
            </a>
          )}

          {body.links.appStore && (
            <a
              href={body.links.appStore}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 transition-colors shadow-xs"
            >
              <span>App Store</span>
              <ArrowUpRight className="size-3.5" />
            </a>
          )}

          {/* Reserved Console Mount Point */}
          {body.consoleId && (
            <button
              type="button"
              disabled
              title="Console coming soon (Track C)"
              aria-label="Open console (coming soon)"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-dashed border-zinc-300 bg-zinc-100/70 px-3 text-xs font-mono font-medium text-zinc-400 cursor-not-allowed opacity-80"
            >
              <Terminal className="size-3.5" />
              <span>Console (coming soon)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
