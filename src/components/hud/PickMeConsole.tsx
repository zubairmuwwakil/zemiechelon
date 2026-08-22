"use client";

import { useMemo, useState } from "react";
import { sound } from "@/lib/audio";
import {
  loadCatalogue,
  loadOwnerState,
  makePurchase,
  recommend,
  type CardProduct,
  type CandidateScore,
  type Network,
  type PurchaseContext,
  type Recommendation,
} from "@/lib/engines/pickme";
import fixturesJson from "@/data/contracts/engine-fixtures.json";

/**
 * The fixture's own purchase shape — the file's fields are wider than what the
 * visitor edits (mcc, merchantBrand ride along from the scenario; only the fields
 * below are exposed as inputs, per the surface design spec §3.7).
 */
interface FixturePurchase {
  amountCad: number;
  category: string;
  mcc?: number | null;
  merchantBrand?: string | null;
  country?: string;
  channel?: string;
  recurringIndicator?: boolean;
  acceptedNetworks: string[];
}

interface FixtureCase {
  caseId: string;
  description: string;
  purchase: FixturePurchase;
}

const fixtures = fixturesJson.cases as unknown as FixtureCase[];

const NETWORKS: Network[] = ["amex", "visa", "mastercard"];

/** Derived from the fixture set, plus the engine's own default — never hand-typed. */
const CHANNELS = Array.from(
  new Set(["cardPresent", ...fixtures.map((c) => c.purchase.channel ?? "cardPresent")]),
);

const CATEGORIES = Array.from(new Set(fixtures.map((c) => c.purchase.category))).sort();

export interface PickMeFormState {
  amountCad: number;
  category: string;
  mcc?: number;
  merchantBrand?: string;
  country: string;
  channel: string;
  recurringIndicator: boolean;
  acceptedNetworks: Network[];
}

/** Seeds a form from one fixture case's purchase — the scenario picker's payload. */
export function fixtureToFormState(purchase: FixturePurchase): PickMeFormState {
  return {
    amountCad: purchase.amountCad,
    category: purchase.category,
    mcc: purchase.mcc ?? undefined,
    merchantBrand: purchase.merchantBrand ?? undefined,
    country: purchase.country ?? "CA",
    channel: purchase.channel ?? "cardPresent",
    recurringIndicator: purchase.recurringIndicator ?? false,
    acceptedNetworks: purchase.acceptedNetworks as Network[],
  };
}

/**
 * `acceptedNetworks` is an array in the form (checkbox-friendly) and in the fixture
 * JSON, but `PurchaseContext.acceptedNetworks` is a `Set<Network>`. This is the one
 * conversion point — a real `new Set(...)`, never a cast.
 */
export function formStateToPurchaseContext(form: PickMeFormState): PurchaseContext {
  return makePurchase({
    amountCad: form.amountCad,
    category: form.category,
    mcc: form.mcc,
    merchantBrand: form.merchantBrand,
    country: form.country,
    channel: form.channel,
    recurringIndicator: form.recurringIndicator,
    acceptedNetworks: new Set(form.acceptedNetworks),
  });
}

function officialNameOf(catalogue: { cards: CardProduct[] }, cardId: string): string {
  return catalogue.cards.find((c) => c.cardId === cardId)?.officialName ?? cardId;
}

function formatCad(amountCad: number): string {
  return amountCad.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

interface PickMeConsoleProps {
  isDay: boolean;
  /** Overridable for tests; defaults to today so a live visit evaluates as-of now. */
  asOf?: string;
}

export function PickMeConsole({ isDay, asOf }: PickMeConsoleProps) {
  const catalogue = useMemo(() => loadCatalogue(), []);
  const ownerState = useMemo(() => loadOwnerState(), []);
  const effectiveAsOf = useMemo(
    () => asOf ?? new Date().toISOString().slice(0, 10),
    [asOf],
  );

  const [caseId, setCaseId] = useState(fixtures[0].caseId);
  const [form, setForm] = useState<PickMeFormState>(() =>
    fixtureToFormState(fixtures[0].purchase),
  );

  const purchase = useMemo(() => formStateToPurchaseContext(form), [form]);
  const recommendation: Recommendation = useMemo(
    () => recommend(catalogue, ownerState, purchase, effectiveAsOf),
    [catalogue, ownerState, purchase, effectiveAsOf],
  );

  const applyScenario = (id: string) => {
    const found = fixtures.find((c) => c.caseId === id);
    if (!found) return;
    sound.playClick(500, 0.04);
    setCaseId(id);
    setForm(fixtureToFormState(found.purchase));
  };

  const toggleNetwork = (network: Network) => {
    sound.playClick(450, 0.03);
    setForm((f) => ({
      ...f,
      acceptedNetworks: f.acceptedNetworks.includes(network)
        ? f.acceptedNetworks.filter((n) => n !== network)
        : [...f.acceptedNetworks, network],
    }));
  };

  const c = {
    well: isDay ? "border-zinc-200/80 bg-zinc-50/70" : "border-white/10 bg-zinc-950/60",
    card: isDay ? "border-zinc-200/80 bg-white" : "border-white/5 bg-zinc-900/80",
    muted: isDay ? "text-zinc-500" : "text-zinc-400",
    dim: isDay ? "text-zinc-600" : "text-zinc-400",
    strong: isDay ? "text-zinc-900" : "text-zinc-50",
    divider: isDay ? "border-zinc-200/70" : "border-white/10",
    input: isDay
      ? "border-zinc-200 bg-white text-zinc-900"
      : "border-white/10 bg-zinc-800 text-zinc-100",
    sky: isDay ? "text-sky-700" : "text-sky-300",
    skyChip: isDay
      ? "border-sky-300/60 bg-sky-50 text-sky-800"
      : "border-sky-400/30 bg-sky-950/50 text-sky-300",
    amber: isDay ? "text-amber-700" : "text-amber-400",
    tile: isDay ? "bg-zinc-100" : "bg-zinc-800/80",
  };

  const winnerCard = catalogue.cards.find((card) => card.cardId === recommendation.winner.cardId);
  const runnerUpCard = recommendation.runnerUp
    ? catalogue.cards.find((card) => card.cardId === recommendation.runnerUp!.cardId)
    : undefined;

  const rankedNonExcluded = recommendation.allCandidates.filter((s) => !s.excluded);

  return (
    <div className={`space-y-5 rounded-2xl border p-4 ${c.well}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">💳</span>
          <div>
            <h3 className="text-base font-bold tracking-tight">PickMe</h3>
            <p className={`text-xs font-medium ${c.muted}`}>iOS Card Copilot</p>
          </div>
        </div>
        <span className={`rounded-md border px-2 py-0.5 font-mono text-xs ${c.skyChip}`}>
          Catalogue v{catalogue.catalogueVersion}
        </span>
      </div>

      {/* Scenario picker — seeded from the 27 cases under CI, per surface design §3.7 */}
      <div className="space-y-1.5">
        <label htmlFor="pickme-scenario" className={`text-xs font-semibold ${c.muted}`}>
          Scenario
        </label>
        <select
          id="pickme-scenario"
          aria-label="Scenario"
          value={caseId}
          onChange={(e) => applyScenario(e.target.value)}
          className={`w-full rounded-lg border px-2.5 py-1.5 font-mono text-xs ${c.input}`}
        >
          {fixtures.map((fx) => (
            <option key={fx.caseId} value={fx.caseId}>
              {fx.description}
            </option>
          ))}
        </select>
      </div>

      {/* The purchase — arrives populated from the scenario above, then editable. */}
      <div className={`grid grid-cols-2 gap-2.5 border-t pt-3 ${c.divider}`}>
        <label className="space-y-1">
          <span className={`text-[11px] font-semibold ${c.muted}`}>Amount (CAD)</span>
          <input
            type="number"
            aria-label="Amount (CAD)"
            value={form.amountCad}
            min={0}
            step="0.01"
            onChange={(e) =>
              setForm((f) => ({ ...f, amountCad: Number(e.target.value) }))
            }
            className={`w-full rounded-lg border px-2 py-1.5 font-mono text-xs ${c.input}`}
          />
        </label>

        <label className="space-y-1">
          <span className={`text-[11px] font-semibold ${c.muted}`}>Category</span>
          <select
            aria-label="Category"
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            className={`w-full rounded-lg border px-2 py-1.5 font-mono text-xs ${c.input}`}
          >
            {CATEGORIES.includes(form.category) ? null : (
              <option value={form.category}>{form.category}</option>
            )}
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className={`text-[11px] font-semibold ${c.muted}`}>Country</span>
          <input
            type="text"
            aria-label="Country"
            value={form.country}
            onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
            className={`w-full rounded-lg border px-2 py-1.5 font-mono text-xs uppercase ${c.input}`}
          />
        </label>

        <label className="space-y-1">
          <span className={`text-[11px] font-semibold ${c.muted}`}>Channel</span>
          <select
            aria-label="Channel"
            value={form.channel}
            onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}
            className={`w-full rounded-lg border px-2 py-1.5 font-mono text-xs ${c.input}`}
          >
            {CHANNELS.map((ch) => (
              <option key={ch} value={ch}>
                {ch}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex items-center gap-2 text-xs font-medium">
        <input
          type="checkbox"
          aria-label="Recurring"
          checked={form.recurringIndicator}
          onChange={(e) =>
            setForm((f) => ({ ...f, recurringIndicator: e.target.checked }))
          }
        />
        <span className={c.dim}>Recurring charge</span>
      </label>

      <div className="space-y-1.5">
        <span className={`text-[11px] font-semibold ${c.muted}`}>Accepted networks</span>
        <div className="flex gap-3">
          {NETWORKS.map((network) => (
            <label key={network} className="flex items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                aria-label={network}
                checked={form.acceptedNetworks.includes(network)}
                onChange={() => toggleNetwork(network)}
              />
              <span className={`font-mono uppercase ${c.dim}`}>{network}</span>
            </label>
          ))}
        </div>
      </div>

      {(form.mcc != null || form.merchantBrand != null) && (
        <div className={`font-mono text-[10px] ${c.muted}`}>
          {form.mcc != null ? `MCC ${form.mcc}` : null}
          {form.mcc != null && form.merchantBrand != null ? " · " : null}
          {form.merchantBrand != null ? form.merchantBrand : null}
        </div>
      )}

      {/* The verdict — every name and figure below comes from recommend()'s output. */}
      <div className={`space-y-2.5 rounded-xl border p-3.5 ${c.card}`}>
        {winnerCard ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-sm font-bold">{winnerCard.officialName}</span>
              <span className={`rounded-md border px-2 py-0.5 font-mono text-[11px] font-bold ${c.skyChip}`}>
                {formatCad(recommendation.winner.netValueCad)}
              </span>
            </div>
            {recommendation.winner.appliedRuleId && (
              <div className={`font-mono text-[10px] ${c.muted}`}>
                rule: {recommendation.winner.appliedRuleId}
              </div>
            )}
            <div className={`font-mono text-[10px] ${c.dim}`}>
              {recommendation.switchedFromDefault
                ? "Switches from your default card."
                : "Stays on your default card."}
              {recommendation.advantageOverDefaultCad != null &&
                ` Advantage ${formatCad(recommendation.advantageOverDefaultCad)}.`}
            </div>
            {recommendation.winner.warnings.length > 0 && (
              <div className={`font-mono text-[10px] ${c.amber}`}>
                {recommendation.winner.warnings.join(", ")}
              </div>
            )}
            {runnerUpCard && (
              <div className={`border-t pt-2 font-mono text-[10px] ${c.divider} ${c.muted}`}>
                runner-up: {runnerUpCard.officialName} ·{" "}
                {formatCad(recommendation.runnerUp!.netValueCad)}
              </div>
            )}
          </>
        ) : (
          <div className={`font-mono text-xs ${c.muted}`}>No card accepted for this purchase.</div>
        )}
      </div>

      {/* Every ranked candidate, straight off recommend()'s allCandidates. */}
      <div className="space-y-1.5">
        <div className={`text-xs font-semibold ${c.muted}`}>Ranked candidates</div>
        <div className="max-h-40 space-y-1.5 overflow-y-auto">
          {rankedNonExcluded.map((candidate: CandidateScore) => (
            <div
              key={candidate.cardId}
              className={`flex items-center justify-between rounded-lg p-2 font-mono text-[11px] ${c.tile}`}
            >
              <span className={c.dim}>{officialNameOf(catalogue, candidate.cardId)}</span>
              <span className={`font-bold ${c.strong}`}>{formatCad(candidate.netValueCad)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
