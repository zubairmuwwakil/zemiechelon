import { Database, Lock, Shield, Zap } from "lucide-react";

export function EngineeringPrinciples() {
  return (
    <section id="principles" className="border-t border-b border-white/[0.06] bg-[#070709] py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 space-y-12">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-xs font-mono text-zinc-400">
            <Shield className="size-3.5 text-zinc-300" />
            <span>ARCHITECTURAL INVARIANTS</span>
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-white">
            Engineering Tenets
          </h2>
          <p className="text-sm text-zinc-400">
            The uncompromised engineering principles guiding every software system built under the Zemi Echelon umbrella.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c10] p-6 space-y-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-white/[0.04] border border-white/[0.08] text-white">
              <Lock className="size-5" />
            </div>
            <h3 className="text-base font-bold text-white">Privacy by Construction</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              We never scrape online banking passwords or use credential-scraping aggregators. Transactions enter via native device shortcuts or client-side imports, encrypted with AES-256-GCM.
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c10] p-6 space-y-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-white/[0.04] border border-white/[0.08] text-white">
              <Zap className="size-5" />
            </div>
            <h3 className="text-base font-bold text-white">Deterministic Arithmetic</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              All financial logic, reward multipliers, and tax rules use integer minor units and pure, side-effect-free engines verified by shared cross-language test fixtures.
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#0c0c10] p-6 space-y-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-white/[0.04] border border-white/[0.08] text-white">
              <Database className="size-5" />
            </div>
            <h3 className="text-base font-bold text-white">Resilient Pipelines &amp; BYOK</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Microservices implement row-level quarantine and idempotency keys. Bring-Your-Own-Key routing ensures users spend their own vendor quotas without server-side credential retention.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
