import Image from "next/image";
import { ArrowDown, ArrowUpRight } from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-12 pb-20 sm:pt-20 sm:pb-28 border-b border-white/[0.06]">
      {/* Background Gradients */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-cyan-500/10 via-emerald-500/10 to-orange-500/10 blur-[120px] pointer-events-none rounded-full" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 text-center">
        {/* Status Pill */}
        <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5 text-xs text-zinc-300 backdrop-blur-md mb-8">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500"></span>
          </span>
          <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">
            Zemi Echelon Holding &amp; Systems
          </span>
          <span className="text-zinc-600">|</span>
          <span className="text-zinc-200">Active Ecosystem</span>
        </div>

        {/* Main Headline */}
        <h1 className="mx-auto max-w-4xl text-4xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl text-white">
          Architecting{" "}
          <span className="bg-gradient-to-r from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent">
            Deterministic Systems
          </span>{" "}
          &amp; Ambient Capital.
        </h1>

        {/* Manifesto Copy */}
        <p className="mx-auto mt-6 max-w-2xl text-sm sm:text-base leading-relaxed text-zinc-400">
          Zemi Echelon is the parent technology umbrella for independent software ventures spanning personal finance command centers, high-resilience market infrastructure, autonomous agent orchestration, and sports operations.
        </p>

        {/* CTA Strip */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <a
            href="#fintech"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-6 text-xs font-semibold text-black shadow-lg transition-all hover:bg-zinc-200 hover:scale-[1.02]"
          >
            <span>Explore The Ecosystem</span>
            <ArrowDown className="size-3.5" />
          </a>
          <a
            href="https://zubairmuwwakil.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-6 text-xs font-semibold text-white backdrop-blur-md transition-all hover:bg-white/[0.08] hover:border-white/20"
          >
            <span>Founder Portfolio (zubairmuwwakil.com)</span>
            <ArrowUpRight className="size-3.5 text-zinc-400" />
          </a>
        </div>

        {/* Zemi Echelon Heritage Crest Showcase */}
        <div className="mt-16 mx-auto max-w-3xl rounded-2xl border border-white/[0.08] bg-[#0d0d12]/60 p-6 backdrop-blur-xl shadow-2xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4 text-left">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white/[0.04] border border-white/[0.08] p-2 glow-emerald">
                <Image src="/icon.svg" alt="Zemi Echelon" width={56} height={56} className="size-full object-contain" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  The Sacred Zemí Trigonolith
                  <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono text-emerald-400 border border-emerald-500/20">
                    PLUS ULTRA
                  </span>
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Rooted in Jamaican Taíno ancestral fortitude, ascending through tiered echelon engineering into sovereign systems.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono text-zinc-400 border-t sm:border-t-0 sm:border-l border-white/[0.08] pt-4 sm:pt-0 sm:pl-6">
              <div className="text-left">
                <div className="text-white font-semibold">Semper Plus Ultra</div>
                <div className="text-[11px] text-zinc-400">Further Beyond</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
