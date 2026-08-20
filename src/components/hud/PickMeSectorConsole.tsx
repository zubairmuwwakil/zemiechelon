"use client";

import { useState } from "react";
import { CreditCard, X, ChevronRight, Zap, CheckCircle2 } from "lucide-react";
import { sound } from "@/lib/audio";

interface PickMeSectorConsoleProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PickMeSectorConsole({ isOpen, onClose }: PickMeSectorConsoleProps) {
  const [activeTab, setActiveTab] = useState<"pickme" | "inunity" | "marketlens">("pickme");

  // PickMe State
  const [centsPerPoint, setCentsPerPoint] = useState(1.8);
  const [purchaseType, setPurchaseType] = useState<"grocery" | "costco" | "travel">("grocery");
  const [amount] = useState(140);

  // Inunity Simulated Transaction State
  const [txnStatus, setTxnStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  // PickMe Deterministic Card Calculation
  const calculateWinner = () => {
    if (purchaseType === "costco") {
      return {
        card: "CIBC Costco Mastercard",
        multiplier: "2% Cashback",
        value: (amount * 0.02).toFixed(2),
        reason: "Costco network gate: Mastercard only accepted at warehouse checkouts.",
      };
    }

    if (purchaseType === "travel") {
      return {
        card: "Scotiabank Passport Visa Infinite",
        multiplier: "3x Points + 0% FX",
        value: ((amount * 3 * centsPerPoint) / 100).toFixed(2),
        reason: "Zero foreign transaction fee waiver saves 2.5% on cross-border charge.",
      };
    }

    // Grocery
    if (centsPerPoint >= 1.2) {
      return {
        card: "American Express Cobalt Card",
        multiplier: "5x Points",
        value: ((amount * 5 * centsPerPoint) / 100).toFixed(2),
        reason: `At ${centsPerPoint.toFixed(1)}¢/pt valuation, 5x MR points yield maximum ROI ($${((amount * 5 * centsPerPoint) / 100).toFixed(2)}).`,
      };
    } else {
      return {
        card: "Scotia Momentum Visa Infinite",
        multiplier: "4% Cash Back",
        value: (amount * 0.04).toFixed(2),
        reason: `At sub-1.2¢/pt MR valuation, pure 4% cash back beats points ($${(amount * 0.04).toFixed(2)}).`,
      };
    }
  };

  const winner = calculateWinner();

  const handleValuationChange = (val: number) => {
    setCentsPerPoint(val);
    sound.playClick(450 + val * 100, 0.03);
  };

  const handleTriggerApplePay = () => {
    sound.playCardFlip();
    setTxnStatus("Apple Pay Shortcut Triggered: $42.50 at Whole Foods CAD posted to Multi-Currency Ledger with Bank of Canada FX sync.");
    setTimeout(() => setTxnStatus(null), 5000);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl rounded-3xl border border-sky-200/80 bg-white/95 p-6 sm:p-7 shadow-2xl space-y-6 text-zinc-900 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-sky-500 text-white shadow-md">
              <CreditCard className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-[10px] font-mono font-bold text-sky-800 uppercase tracking-wider">
                  FINTECH CONTINUUM
                </span>
                <span className="text-xs font-mono text-zinc-600">Deterministic Engines</span>
              </div>
              <h2 className="text-xl font-extrabold tracking-tight text-zinc-900">
                PickMe &amp; The Inunity Suite
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-100 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 rounded-2xl bg-zinc-100 p-1 text-xs font-mono font-semibold">
          <button
            onClick={() => setActiveTab("pickme")}
            className={`flex-1 py-1.5 px-3 rounded-xl transition-all ${
              activeTab === "pickme" ? "bg-white text-zinc-900 shadow-xs" : "text-zinc-500 hover:text-zinc-800"
            }`}
          >
            PickMe Card Copilot
          </button>
          <button
            onClick={() => setActiveTab("inunity")}
            className={`flex-1 py-1.5 px-3 rounded-xl transition-all ${
              activeTab === "inunity" ? "bg-white text-zinc-900 shadow-xs" : "text-zinc-500 hover:text-zinc-800"
            }`}
          >
            Inunity (inunity.ca)
          </button>
          <button
            onClick={() => setActiveTab("marketlens")}
            className={`flex-1 py-1.5 px-3 rounded-xl transition-all ${
              activeTab === "marketlens" ? "bg-white text-zinc-900 shadow-xs" : "text-zinc-500 hover:text-zinc-800"
            }`}
          >
            MarketLens Pipeline
          </button>
        </div>

        {/* TAB 1: PICKME */}
        {activeTab === "pickme" && (
          <div className="space-y-5">
            {/* Merchant Scenario Selector */}
            <div className="space-y-1.5">
              <div className="text-xs font-mono font-semibold text-zinc-600 uppercase tracking-wider">
                Select Checkout Merchant Context
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setPurchaseType("grocery")}
                  className={`p-2.5 rounded-xl border text-xs font-mono text-left transition-all ${
                    purchaseType === "grocery"
                      ? "border-sky-500 bg-sky-50/80 font-bold text-sky-950 shadow-xs"
                      : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
                  }`}
                >
                  <div>🛒 Grocery Store</div>
                  <div className="text-[10px] text-zinc-600 mt-0.5">$140 at Metro</div>
                </button>
                <button
                  onClick={() => setPurchaseType("costco")}
                  className={`p-2.5 rounded-xl border text-xs font-mono text-left transition-all ${
                    purchaseType === "costco"
                      ? "border-sky-500 bg-sky-50/80 font-bold text-sky-950 shadow-xs"
                      : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
                  }`}
                >
                  <div>🏬 Costco Warehouse</div>
                  <div className="text-[10px] text-zinc-600 mt-0.5">$320 Mastercard Gate</div>
                </button>
                <button
                  onClick={() => setPurchaseType("travel")}
                  className={`p-2.5 rounded-xl border text-xs font-mono text-left transition-all ${
                    purchaseType === "travel"
                      ? "border-sky-500 bg-sky-50/80 font-bold text-sky-950 shadow-xs"
                      : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
                  }`}
                >
                  <div>✈️ US Travel Booking</div>
                  <div className="text-[10px] text-zinc-600 mt-0.5">$650 USD No-FX</div>
                </button>
              </div>
            </div>

            {/* Valuation Slider */}
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50/60 p-4 space-y-2">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-zinc-600">Point Valuation (cents per point):</span>
                <span className="text-sm font-bold text-sky-700">{centsPerPoint.toFixed(1)} ¢ / pt</span>
              </div>
              <input
                type="range"
                min="0.8"
                max="2.4"
                step="0.1"
                value={centsPerPoint}
                onChange={(e) => handleValuationChange(Number(e.target.value))}
                className="w-full accent-sky-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] font-mono text-zinc-600">
                <span>0.8¢ (Base Cashout)</span>
                <span>1.2¢ (Breakeven)</span>
                <span>2.4¢ (Flight Transfer)</span>
              </div>
            </div>

            {/* Winning Card Card */}
            <div className="rounded-2xl border border-sky-300 bg-gradient-to-br from-sky-50 to-white p-5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="size-4 text-sky-600" />
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-sky-800">
                    Engine Recommendation
                  </span>
                </div>
                <span className="rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-xs font-mono font-bold">
                  Yield: ${winner.value}
                </span>
              </div>

              <div>
                <h3 className="text-lg font-bold text-zinc-900">{winner.card}</h3>
                <p className="text-xs font-mono text-sky-700">{winner.multiplier}</p>
              </div>

              <p className="text-xs text-zinc-600 leading-relaxed border-t border-sky-100 pt-2">
                {winner.reason}
              </p>
            </div>
          </div>
        )}

        {/* TAB 2: INUNITY */}
        {activeTab === "inunity" && (
          <div className="space-y-4 text-xs">
            <p className="text-zinc-600 leading-relaxed">
              <strong>Inunity (inunity.ca)</strong> is a personal finance command center engineered with zero bank-login scraping. It captures real-time iOS Wallet Apple Pay automations, maintains a multi-currency ledger (CAD/USD/JMD), and validates 24 statutory compliance rules.
            </p>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-3">
              <h4 className="text-xs font-bold font-mono text-emerald-950 uppercase tracking-wider">
                Simulate Zero-Bank-Login Apple Pay Capture
              </h4>
              <button
                onClick={handleTriggerApplePay}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-700 transition-colors"
              >
                <span>Trigger iOS Wallet Shortcut ($42.50)</span>
              </button>

              {txnStatus && (
                <div className="rounded-xl border border-emerald-300 bg-white p-3 font-mono text-emerald-900 animate-in fade-in">
                  <CheckCircle2 className="size-3.5 inline mr-1 text-emerald-600" />
                  {txnStatus}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 font-mono">
              <div className="rounded-xl border border-zinc-200 bg-white p-3">
                <div className="font-bold text-zinc-800">24 Compliance Rules</div>
                <div className="text-[11px] text-zinc-600 mt-1">FBAR ($10k USD), T1135 ($100k CAD), FHSA headroom ($8k/yr), RDSP grant tiers.</div>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white p-3">
                <div className="font-bold text-zinc-800">Live FX Synchronisation</div>
                <div className="text-[11px] text-zinc-600 mt-1">Direct Bank of Canada Valet API daily closing exchange rate sync.</div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: MARKETLENS */}
        {activeTab === "marketlens" && (
          <div className="space-y-4 text-xs">
            <p className="text-zinc-600 leading-relaxed">
              <strong>MarketLens</strong> is an enterprise Java 21 / Spring Boot 4 pipeline with idempotent ingestion runs, row-level quarantine buffers, Bucket4j token-bucket rate limiting, and technical indicator analytics (RSI, EMA, MACD).
            </p>

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 space-y-2 font-mono">
              <div className="flex justify-between font-bold text-zinc-800">
                <span>Ingestion Pipeline Telemetry</span>
                <span className="text-emerald-600">IDEMPOTENT RUN #1042</span>
              </div>
              <div className="space-y-1 text-zinc-600 text-[11px]">
                <div>• Alpha Vantage Ingestion: 500 OHLCV daily bars processed</div>
                <div>• Row-Level Quarantine Buffer: 0 malformed rows isolated</div>
                <div>• Prometheus Metrics: 14ms average query latency</div>
                <div>• Bucket4j Rate Limiting: 5 tokens/min BYOK routing</div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-100 text-xs font-mono">
          <a
            href="https://inunity.ca"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sky-700 hover:text-sky-900 font-semibold"
          >
            <span>inunity.ca (Live Production)</span>
            <ChevronRight className="size-3.5" />
          </a>
          <span className="text-zinc-600">Capital &amp; Financial Operating Systems</span>
        </div>
      </div>
    </div>
  );
}
