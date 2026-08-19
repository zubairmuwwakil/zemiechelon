import {
  ArrowUpRight,
  Bot,
  Brain,
  CheckCircle2,
  Coins,
  Cpu,
  CreditCard,
  FileCode2,
  Globe2,
  LineChart,
  Lock,
  Receipt,
  Repeat,
  Shield,
  Smartphone,
  Sparkles,
  Terminal,
  Trophy,
  Undo2,
  Zap,
} from "lucide-react";

export function EcosystemShowcase() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 space-y-28">
      {/* 1. Core Financial Suite */}
      <section id="fintech" className="space-y-10">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-400">
            <Coins className="size-3.5" />
            <span>Pillar 01 — Capital &amp; Financial Operating Systems</span>
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-white">
            The Inunity Financial Continuum
          </h2>
          <p className="text-sm text-zinc-400 max-w-2xl leading-relaxed">
            Four independent software products engineered with zero bank-login scraping. Standalone by design, compound in unity.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Inunity Card */}
          <div className="relative rounded-2xl border border-white/[0.08] bg-[#0c0c10] p-6 sm:p-8 flex flex-col justify-between transition-all hover:border-cyan-500/40 hover:bg-[#0e0e14] group">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex size-10 items-center justify-center rounded-xl bg-white/[0.06] border border-white/[0.1] text-cyan-400">
                  <Coins className="size-5" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-mono font-semibold">
                    PRODUCTION
                  </span>
                  <a
                    href="https://inunity.ca"
                    target="_blank"
                    rel="noreferrer"
                    className="flex size-7 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.02] text-zinc-400 hover:text-white transition-colors"
                  >
                    <ArrowUpRight className="size-3.5" />
                  </a>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white group-hover:text-cyan-300 transition-colors">
                  Inunity (inunity.ca)
                </h3>
                <p className="text-xs font-mono text-zinc-400 mt-0.5">
                  Next.js 16 · TypeScript · Prisma · Neon · Vercel
                </p>
              </div>

              <p className="text-xs text-zinc-300 leading-relaxed">
                Personal finance command center with <strong>Zero-Bank-Login Apple Pay Capture</strong> via iOS Wallet Automations, multi-currency ledger (CAD/USD/JMD), 12-month bill forecasting with cash cushion warnings, and 24 statutory tax/benefit compliance engines (FBAR, T1135, RDSP, FHSA).
              </p>

              <div className="pt-2 border-t border-white/[0.06] space-y-1.5 text-[11px] text-zinc-400">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-cyan-400" />
                  <span>Instant Apple Pay Shortcut capture</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-cyan-400" />
                  <span>Bank of Canada Valet live FX synchronisation</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-between text-xs">
              <a
                href="https://github.com/zubairmuwwakil/MoneyTalks"
                target="_blank"
                rel="noreferrer"
                className="text-zinc-400 hover:text-white font-mono flex items-center gap-1"
              >
                <span>github/MoneyTalks</span>
                <ArrowUpRight className="size-3" />
              </a>
              <span className="text-[11px] text-zinc-400 font-mono">Central Command Hub</span>
            </div>
          </div>

          {/* PickMe Card */}
          <div className="relative rounded-2xl border border-white/[0.08] bg-[#0c0c10] p-6 sm:p-8 flex flex-col justify-between transition-all hover:border-sky-500/40 hover:bg-[#0e0e14] group">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex size-10 items-center justify-center rounded-xl bg-white/[0.06] border border-white/[0.1] text-sky-400">
                  <CreditCard className="size-5" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2.5 py-0.5 text-[10px] font-mono font-semibold">
                    IOS 18 NATIVE
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white group-hover:text-sky-300 transition-colors">
                  PickMe — Canadian Card Copilot
                </h3>
                <p className="text-xs font-mono text-zinc-400 mt-0.5">
                  Swift 6 · SwiftUI · SwiftData · MapKit · Apple Maps
                </p>
              </div>

              <p className="text-xs text-zinc-300 leading-relaxed">
                100% offline native iOS copilot that tells multi-card holders exactly which credit card in their wallet to swipe right now. Evaluates earn multipliers, point valuations, monthly category caps, foreign exchange fees, and network gates (e.g. Costco = Mastercard).
              </p>

              <div className="pt-2 border-t border-white/[0.06] space-y-1.5 text-[11px] text-zinc-400">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-sky-400" />
                  <span>Pure deterministic calculation engine</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-sky-400" />
                  <span>Annual fee ROI &amp; keep/cancel audits</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-between text-xs">
              <a
                href="https://github.com/zubairmuwwakil/PickMe"
                target="_blank"
                rel="noreferrer"
                className="text-zinc-400 hover:text-white font-mono flex items-center gap-1"
              >
                <span>github/PickMe</span>
                <ArrowUpRight className="size-3" />
              </a>
              <span className="text-[11px] text-zinc-400 font-mono">Before Purchase</span>
            </div>
          </div>

          {/* MarketLens Card */}
          <div className="relative rounded-2xl border border-white/[0.08] bg-[#0c0c10] p-6 sm:p-8 flex flex-col justify-between transition-all hover:border-emerald-500/40 hover:bg-[#0e0e14] group">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex size-10 items-center justify-center rounded-xl bg-white/[0.06] border border-white/[0.1] text-emerald-400">
                  <LineChart className="size-5" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-mono font-semibold">
                    ENTERPRISE API
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white group-hover:text-emerald-300 transition-colors">
                  MarketLens
                </h3>
                <p className="text-xs font-mono text-zinc-400 mt-0.5">
                  Java 21 · Spring Boot 4 · PostgreSQL 16 · Flyway · Alpha Vantage
                </p>
              </div>

              <p className="text-xs text-zinc-300 leading-relaxed">
                High-resilience market data pipeline with idempotent ingestion runs, row-level quarantine for malformed upstream payloads, daily OHLCV closing candles, RSI/EMA/MACD technical indicators, NYSE market calendar, and Bring-Your-Own-Key (BYOK) per-request routing.
              </p>

              <div className="pt-2 border-t border-white/[0.06] space-y-1.5 text-[11px] text-zinc-400">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-emerald-400" />
                  <span>Zero-dependency Demo Profile (-Pdemo)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-emerald-400" />
                  <span>Bucket4j rate limits &amp; Prometheus metrics</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-between text-xs">
              <a
                href="https://github.com/zubairmuwwakil/marketdata"
                target="_blank"
                rel="noreferrer"
                className="text-zinc-400 hover:text-white font-mono flex items-center gap-1"
              >
                <span>github/marketdata</span>
                <ArrowUpRight className="size-3" />
              </a>
              <span className="text-[11px] text-zinc-400 font-mono">Market Valuation</span>
            </div>
          </div>

          {/* Looply Card */}
          <div className="relative rounded-2xl border border-white/[0.08] bg-[#0c0c10] p-6 sm:p-8 flex flex-col justify-between transition-all hover:border-orange-500/40 hover:bg-[#0e0e14] group">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex size-10 items-center justify-center rounded-xl bg-white/[0.06] border border-white/[0.1] text-orange-400">
                  <Repeat className="size-5" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2.5 py-0.5 text-[10px] font-mono font-semibold">
                    INBOX SAAS
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white group-hover:text-orange-300 transition-colors">
                  Looply (Return SaaS)
                </h3>
                <p className="text-xs font-mono text-zinc-400 mt-0.5">
                  Next.js 15 · Prisma · Stripe · Gmail API · IMAP
                </p>
              </div>

              <p className="text-xs text-zinc-300 leading-relaxed">
                Autonomous email-derived commerce intelligence. Direct inbox ingestion for purchase proofs, itemized receipts, return window countdowns, trial/subscription renewal detection, and package tracking carrier sync.
              </p>

              <div className="pt-2 border-t border-white/[0.06] space-y-1.5 text-[11px] text-zinc-400">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-orange-400" />
                  <span>Detected Inbox for trial expirations</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-orange-400" />
                  <span>Stripe billing &amp; automated digest workers</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-between text-xs">
              <a
                href="https://github.com/zubairmuwwakil/return-saas"
                target="_blank"
                rel="noreferrer"
                className="text-zinc-400 hover:text-white font-mono flex items-center gap-1"
              >
                <span>github/return-saas</span>
                <ArrowUpRight className="size-3" />
              </a>
              <span className="text-[11px] text-zinc-400 font-mono">Post-Purchase &amp; Returns</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Autonomous Systems & Developer Tools */}
      <section id="intelligence" className="space-y-10">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-400">
            <Cpu className="size-3.5" />
            <span>Pillar 02 — Autonomous Systems &amp; Developer Infrastructure</span>
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-white">
            Intelligent Execution &amp; Tooling
          </h2>
          <p className="text-sm text-zinc-400 max-w-2xl leading-relaxed">
            Developer tools, algorithmic rating engines, and autonomous execution frameworks.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {/* Agent Orchestrator */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c10] p-6 flex flex-col justify-between transition-all hover:border-purple-500/40 hover:bg-[#0e0e14]">
            <div className="space-y-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400">
                <Bot className="size-4.5" />
              </div>
              <h3 className="text-base font-bold text-white">Agent Orchestrator</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Multi-agent runtime for autonomous coding workflows, task delegation, and distributed tool execution.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-white/[0.06] text-xs font-mono">
              <a
                href="https://github.com/zubairmuwwakil/agent-orchestrator"
                target="_blank"
                rel="noreferrer"
                className="text-zinc-400 hover:text-white flex items-center gap-1"
              >
                <span>github/agent-orchestrator</span>
                <ArrowUpRight className="size-3" />
              </a>
            </div>
          </div>

          {/* Mindmap */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c10] p-6 flex flex-col justify-between transition-all hover:border-blue-500/40 hover:bg-[#0e0e14]">
            <div className="space-y-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
                <Brain className="size-4.5" />
              </div>
              <h3 className="text-base font-bold text-white">Mindmap</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Visual graph architecture and interactive concept node mapping for software system design and knowledge graphs.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-white/[0.06] text-xs font-mono">
              <a
                href="https://github.com/zubairmuwwakil/mindmap"
                target="_blank"
                rel="noreferrer"
                className="text-zinc-400 hover:text-white flex items-center gap-1"
              >
                <span>github/mindmap</span>
                <ArrowUpRight className="size-3" />
              </a>
            </div>
          </div>

          {/* Glicko2-TS */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c10] p-6 flex flex-col justify-between transition-all hover:border-emerald-500/40 hover:bg-[#0e0e14]">
            <div className="space-y-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <FileCode2 className="size-4.5" />
              </div>
              <h3 className="text-base font-bold text-white">Glicko2-TS</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Pure TypeScript mathematical implementation of the Glicko-2 rating system for competitive matchmaking and rating deviations.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-white/[0.06] text-xs font-mono">
              <a
                href="https://github.com/zubairmuwwakil/glicko2-ts"
                target="_blank"
                rel="noreferrer"
                className="text-zinc-400 hover:text-white flex items-center gap-1"
              >
                <span>github/glicko2-ts</span>
                <ArrowUpRight className="size-3" />
              </a>
            </div>
          </div>

          {/* Command Quest */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c10] p-6 flex flex-col justify-between transition-all hover:border-amber-500/40 hover:bg-[#0e0e14]">
            <div className="space-y-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <Terminal className="size-4.5" />
              </div>
              <h3 className="text-base font-bold text-white">Command Quest</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Gamified interactive CLI terminal environment and shell learning platform for mastering POSIX tools and developer workflows.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-white/[0.06] text-xs font-mono">
              <a
                href="https://github.com/zubairmuwwakil/command-quest"
                target="_blank"
                rel="noreferrer"
                className="text-zinc-400 hover:text-white flex items-center gap-1"
              >
                <span>github/command-quest</span>
                <ArrowUpRight className="size-3" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Sports & Operational Systems */}
      <section id="sports" className="space-y-10">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
            <Trophy className="size-3.5" />
            <span>Pillar 03 — Sports Systems &amp; Operations</span>
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-white">
            The Pickleball Social &amp; PickleOps
          </h2>
          <p className="text-sm text-zinc-400 max-w-2xl leading-relaxed">
            Shipped mobile apps and operational platforms for competitive round-robins, court session scheduling, and dynamic skill ratings.
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c10] p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-3 max-w-xl">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-mono font-semibold">
                SHIPPED TO APP STORE
              </span>
            </div>
            <h3 className="text-xl font-bold text-white">The Pickleball Social &amp; PickleOps</h3>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Full-stack tournament management, dynamic Glicko-2 / DUPR rating sync, round-robin court rotation scheduling, and member check-ins for active athletic clubs.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <a
              href="https://github.com/zubairmuwwakil/pickleops"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-5 text-xs font-semibold text-white transition-all hover:bg-white/[0.08]"
            >
              <span>View Repository</span>
              <ArrowUpRight className="size-3.5 text-zinc-400" />
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
