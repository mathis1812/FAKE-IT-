"use client";

import { useState } from "react";
import Panel from "@/components/Panel";
import SubscribeButton from "@/components/SubscribeButton";
import ManageSubscriptionButton from "@/components/ManageSubscriptionButton";
import type { BillingPeriod, PlanId } from "@/lib/stripe";

type PlanView = {
  id: PlanId;
  name: string;
  monthlyPriceEur: number;
  annualPriceEur: number;
  creditsPerMonth: number;
  features: string[];
};

function formatEur(amount: number): string {
  return amount.toFixed(2).replace(".", ",");
}

export default function PricingGrid({
  plans,
  currentPlan,
  isLoggedIn,
}: {
  plans: PlanView[];
  currentPlan: PlanId | null;
  isLoggedIn: boolean;
}) {
  const [period, setPeriod] = useState<BillingPeriod>("monthly");

  return (
    <div>
      <div className="mb-8 flex justify-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-foreground/10 p-1 text-xs font-semibold uppercase tracking-[0.1em]">
          <button
            type="button"
            onClick={() => setPeriod("monthly")}
            className={`rounded-full px-4 py-1.5 transition ${
              period === "monthly"
                ? "bg-primary text-ink"
                : "text-foreground/65 hover:text-foreground"
            }`}
          >
            Mensuel
          </button>
          <button
            type="button"
            onClick={() => setPeriod("annual")}
            className={`rounded-full px-4 py-1.5 transition ${
              period === "annual"
                ? "bg-primary text-ink"
                : "text-foreground/65 hover:text-foreground"
            }`}
          >
            Annuel · -20%
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = currentPlan === plan.id;
          const annualEffectiveMonthly = plan.annualPriceEur / 12;

          return (
            <Panel key={plan.id} className="flex flex-col p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-xl font-semibold text-foreground">
                  {plan.name}
                </h3>
                {isCurrent && (
                  <span className="rounded-full bg-primary/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary-soft">
                    Plan actuel
                  </span>
                )}
              </div>

              {period === "monthly" ? (
                <p className="mb-1 text-3xl font-semibold text-foreground">
                  {formatEur(plan.monthlyPriceEur)} €
                  <span className="text-sm font-normal text-foreground/50">
                    /mois
                  </span>
                </p>
              ) : (
                <div className="mb-1">
                  <p className="flex items-baseline gap-2">
                    <span className="text-sm font-medium text-foreground/35 line-through">
                      {formatEur(plan.monthlyPriceEur)} €/mois
                    </span>
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-primary-soft">
                      -20%
                    </span>
                  </p>
                  <p className="text-3xl font-semibold text-foreground">
                    {formatEur(annualEffectiveMonthly)} €
                    <span className="text-sm font-normal text-foreground/50">
                      /mois
                    </span>
                  </p>
                  <p className="text-xs text-foreground/50">
                    Facturé {formatEur(plan.annualPriceEur)} €/an
                  </p>
                </div>
              )}

              <p className="mb-4 mt-2 text-sm text-foreground/65">
                {plan.creditsPerMonth.toLocaleString("fr-FR")} crédits/mois
                {period === "annual" && (
                  <span className="text-foreground/35">
                    {" "}
                    (crédités en une fois pour l&apos;année)
                  </span>
                )}
              </p>

              <ul className="mb-6 flex-1 space-y-2.5 text-sm text-foreground/65">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-primary" />
                    {feature}
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <div className="rounded-2xl border border-foreground/10 px-4 py-3 text-center text-sm font-medium text-foreground/50">
                  Ton palier actuel
                </div>
              ) : currentPlan ? (
                <ManageSubscriptionButton />
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
