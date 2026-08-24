"use client";

import { useState } from "react";
import Panel from "@/components/Panel";
import SubscribeButton from "@/components/SubscribeButton";
import ManageSubscriptionButton from "@/components/ManageSubscriptionButton";
import { formatPrice, type BillingPeriod, type PlanId } from "@/lib/stripe";

/**
 * One row of the comparison grid: same label across the 3 tiers, one cell
 * per tier (check, cross, or a text value like resolution). Built as a
 * single shared array rather than per-tier lists, to guarantee that the 3
 * cards show the same rows in the same order — a requirement for the
 * comparison effect (what Starter doesn't have) to read at a glance.
 */
export type ComparisonCell =
  | { kind: "check" }
  | { kind: "cross" }
  | { kind: "value"; text: string; bold?: boolean };

export type ComparisonRow = {
  label: string;
  decouverte: ComparisonCell;
  essentiel: ComparisonCell;
  ultimate: ComparisonCell;
};

type PlanView = {
  id: PlanId;
  name: string;
  monthlyPriceUsd: number;
  annualPriceUsd: number;
  creditsPerMonth: number;
};

function ComparisonCellView({ cell }: { cell: ComparisonCell }) {
  if (cell.kind === "check") {
    return (
      <span aria-label="Included" className="text-primary">
        ✓
      </span>
    );
  }
  if (cell.kind === "cross") {
    return (
      <span aria-label="Not included" className="text-neutral-700">
        ✕
      </span>
    );
  }
  return (
    <span
      className={cell.bold ? "font-semibold text-white" : "text-neutral-300"}
    >
      {cell.text}
    </span>
  );
}

/**
 * Background and border per tier: same purple family as the studio (no
 * colors foreign to the visual identity), increasing intensity so the
 * recommended tier stands out without breaking the grid's cohesion.
 */
const TIER_STYLES: Record<PlanId, { panel: string; ring: string }> = {
  decouverte: {
    panel: "bg-gradient-to-b from-white/[0.03] to-transparent",
    ring: "",
  },
  essentiel: {
    panel: "bg-gradient-to-b from-primary/[0.10] via-[#13101b] to-[#13101b]",
    ring: "",
  },
  ultimate: {
    panel:
      "bg-gradient-to-br from-primary-deep/50 via-[#1b1330] to-[#13101b] sm:scale-[1.03]",
    ring: "ring-1 ring-primary/40 shadow-[0_0_40px_-12px_rgba(168,85,247,0.55)]",
  },
};

export default function PricingGrid({
  plans,
  comparisonRows,
  currentPlan,
  isLoggedIn,
}: {
  plans: PlanView[];
  comparisonRows: ComparisonRow[];
  currentPlan: PlanId | null;
  isLoggedIn: boolean;
}) {
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  // An existing subscriber changes tier via ManageSubscriptionButton, which
  // only sends targetPlan: the current billing period is reused server-side
  // (see app/api/stripe/portal/route.ts) and can't be changed from this
  // screen. Hiding the selector avoids showing an annual price when the
  // click would actually subscribe monthly (or vice versa).
  const canChoosePeriod = !currentPlan;

  return (
    <div>
      {canChoosePeriod && (
        <div className="mb-8 flex justify-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 p-1 text-xs font-semibold uppercase tracking-[0.1em]">
            <button
              type="button"
              onClick={() => setPeriod("monthly")}
              className={`rounded-full px-4 py-1.5 transition ${
                period === "monthly"
                  ? "bg-primary text-ink"
                  : "text-neutral-400 hover:text-neutral-100"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setPeriod("annual")}
              className={`rounded-full px-4 py-1.5 transition ${
                period === "annual"
                  ? "bg-primary text-ink"
                  : "text-neutral-400 hover:text-neutral-100"
              }`}
            >
              Annual · -20%
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 sm:items-start">
        {plans.map((plan) => {
          const isCurrent = currentPlan === plan.id;
          const isHighlighted = plan.id === "ultimate";
          const annualEffectiveMonthly = plan.annualPriceUsd / 12;
          const showDiscountBadge = period === "annual" && canChoosePeriod;
          const tier = TIER_STYLES[plan.id];

          return (
            <Panel
              key={plan.id}
              className={`flex flex-col p-6 transition ${tier.panel} ${tier.ring}`}
            >
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <h3 className="font-display text-xl font-semibold text-white">
                  {plan.name}
                </h3>
                {showDiscountBadge && (
                  <span className="rounded-full bg-red-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-white">
                    -20%
                  </span>
                )}
                {isHighlighted && (
                  <span className="rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-ink">
                    Best value
                  </span>
                )}
                {isCurrent && (
                  <span className="ml-auto rounded-full bg-primary/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary-soft">
                    Current plan
                  </span>
                )}
              </div>

              {period === "monthly" ? (
                <p className="mb-1 text-3xl font-semibold text-white">
                  {formatPrice(plan.monthlyPriceUsd)}
                  <span className="text-sm font-normal text-neutral-500">
                    /mo
                  </span>
                </p>
              ) : (
                <div className="mb-1">
                  <p className="text-lg font-medium text-neutral-500 line-through decoration-red-500/70 decoration-2">
                    {formatPrice(plan.monthlyPriceUsd)}/mo
                  </p>
                  <p className="text-4xl font-semibold text-white">
                    {formatPrice(annualEffectiveMonthly)}
                    <span className="text-sm font-normal text-neutral-500">
                      /mo
                    </span>
                  </p>
                  <p className="text-xs text-neutral-500">
                    Billed {formatPrice(plan.annualPriceUsd)}/year
                  </p>
                </div>
              )}

              <p className="mb-4 mt-2 text-sm text-neutral-400">
                {plan.creditsPerMonth.toLocaleString("en-US")} credits/mo
                {period === "annual" && (
                  <span className="text-neutral-600">
                    {" "}
                    (credited all at once for the year)
                  </span>
                )}
              </p>

              <ul className="mb-6 flex-1 space-y-2.5 text-sm text-neutral-400">
                {comparisonRows.map((row) => (
                  <li
                    key={row.label}
                    className="flex items-center justify-between gap-3"
                  >
                    <span>{row.label}</span>
                    <ComparisonCellView cell={row[plan.id]} />
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <div className="rounded-2xl border border-white/10 px-4 py-3 text-center text-sm font-medium text-neutral-500">
                  Your current plan
                </div>
              ) : currentPlan ? (
                <div>
                  <ManageSubscriptionButton targetPlan={plan.id} />
                  <p className="mt-2 text-center text-xs text-neutral-600">
                    Prices shown as a monthly reference — your current
                    billing (monthly or annual) is kept as is.
                  </p>
                  <p className="mt-1 text-center text-xs text-neutral-600">
                    The new credit allowance applies at your next renewal.
                  </p>
                </div>
              ) : (
                <SubscribeButton
                  plan={plan.id}
                  period={period}
                  isLoggedIn={isLoggedIn}
                />
              )}
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
