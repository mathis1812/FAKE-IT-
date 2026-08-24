"use client";

import { useState } from "react";
import Panel from "@/components/Panel";
import SubscribeButton from "@/components/SubscribeButton";
import ManageSubscriptionButton from "@/components/ManageSubscriptionButton";
import { formatPrice, type BillingPeriod, type PlanId } from "@/lib/stripe";

/**
 * Une ligne de la grille comparative : même libellé sur les 3 paliers, une
 * cellule par palier (coche, croix, ou valeur textuelle comme la
 * résolution). Construite en un seul tableau partagé plutôt qu'en listes
 * par palier, pour garantir que les 3 cartes affichent les mêmes lignes
 * dans le même ordre — condition pour que l'effet de comparaison (ce que
 * Découverte n'a pas) se lise d'un coup d'œil.
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
      <span aria-label="Inclus" className="text-primary">
        ✓
      </span>
    );
  }
  if (cell.kind === "cross") {
    return (
      <span aria-label="Non inclus" className="text-neutral-700">
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
 * Fond et bordure par palier : même famille violette du studio (pas de
 * couleurs étrangères à la DA), intensité croissante pour que le palier
 * recommandé se détache sans rompre l'homogénéité de la grille.
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
  // Un abonné existant change de palier via ManageSubscriptionButton, qui ne
  // transmet que targetPlan : la périodicité en cours est réutilisée côté
  // serveur (voir app/api/stripe/portal/route.ts) et ne peut pas être
  // changée depuis cet écran. Masquer le sélecteur évite d'afficher un prix
  // annuel alors que le clic souscrirait au mensuel (ou l'inverse).
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
              Mensuel
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
              Annuel · -20%
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
                    Meilleure offre
                  </span>
                )}
                {isCurrent && (
                  <span className="ml-auto rounded-full bg-primary/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary-soft">
                    Plan actuel
                  </span>
                )}
              </div>

              {period === "monthly" ? (
                <p className="mb-1 text-3xl font-semibold text-white">
                  {formatPrice(plan.monthlyPriceUsd)}
                  <span className="text-sm font-normal text-neutral-500">
                    /mois
                  </span>
                </p>
              ) : (
                <div className="mb-1">
                  <p className="text-lg font-medium text-neutral-500 line-through decoration-red-500/70 decoration-2">
                    {formatPrice(plan.monthlyPriceUsd)}/mois
                  </p>
                  <p className="text-4xl font-semibold text-white">
                    {formatPrice(annualEffectiveMonthly)}
                    <span className="text-sm font-normal text-neutral-500">
                      /mois
                    </span>
                  </p>
                  <p className="text-xs text-neutral-500">
                    Facturé {formatPrice(plan.annualPriceUsd)}/an
                  </p>
                </div>
              )}

              <p className="mb-4 mt-2 text-sm text-neutral-400">
                {plan.creditsPerMonth.toLocaleString("fr-FR")} crédits/mois
                {period === "annual" && (
                  <span className="text-neutral-600">
                    {" "}
                    (crédités en une fois pour l&apos;année)
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
                  Ton palier actuel
                </div>
              ) : currentPlan ? (
                <div>
                  <ManageSubscriptionButton targetPlan={plan.id} />
                  <p className="mt-2 text-center text-xs text-neutral-600">
                    Prix affichés en référence mensuelle — ta facturation
                    actuelle (mensuelle ou annuelle) est conservée.
                  </p>
                  <p className="mt-1 text-center text-xs text-neutral-600">
                    Le nouveau forfait de crédits s&apos;applique à ton
                    prochain renouvellement.
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
