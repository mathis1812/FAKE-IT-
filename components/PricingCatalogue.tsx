"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PLANS, TOPUPS, formatPrice, type PlanId, type TopupId } from "@/lib/stripe";

/**
 * Catalogue d'abonnements et de packs de crédits, partagé par `/pricing`
 * (page complète) et `RechargeSheet` (feuille ouverte depuis le studio) —
 * la grille de cartes ne doit exister qu'à un seul endroit.
 *
 * Structure relevée le 29/08 sur la feuille « Recharger » du produit de
 * référence : un bandeau à deux onglets (Abonnements / Crédits), une grille
 * de trois cartes, une liste de fonctions, un bouton pleine largeur.
 *
 * La bascule de la barre de prix (le « notch » qui semble découpé dans le
 * coin de l'icône) est un masque radial en CSS, copié tel quel depuis les
 * classes calculées du modèle plutôt que reconstruit à l'oeil.
 */

const NOTCH_MASK_LEFT =
  "radial-gradient(circle at 100% 0px, transparent 15.25px, #000 15.75px)";
const NOTCH_MASK_RIGHT =
  "radial-gradient(circle at 0px 0px, transparent 15.25px, #000 15.75px)";

function PriceCardNotches({ tint }: { tint: string }) {
  return (
    <>
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-full left-0 h-[15.5px] w-[15.5px]"
        style={{ background: tint, maskImage: NOTCH_MASK_LEFT }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-full right-0 h-[15.5px] w-[15.5px]"
        style={{ background: tint, maskImage: NOTCH_MASK_RIGHT }}
      />
    </>
  );
}

const LIGHTNING_PATH =
  "M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z";

const SUBSCRIPTION_TIERS: { id: PlanId; badge?: string }[] = [
  { id: "lite" },
  { id: "pro", badge: "−10%" },
  { id: "max", badge: "−20%" },
];

const TOPUP_TIERS: { id: TopupId; badge?: string }[] = [
  { id: "small" },
  { id: "medium", badge: "−10%" },
  { id: "large", badge: "−20%" },
];

const SUBSCRIPTION_FEATURES = [
  "Red Snap access",
  "All effects unlocked",
  "Images up to 4K",
  "Credits renewed weekly",
];

const TOPUP_FEATURES = [
  "Added to your balance instantly",
  "Credits never expire",
  "One-time payment, no subscription",
];

export default function PricingCatalogue() {
  const router = useRouter();
  const [tab, setTab] = useState<"subscription" | "topup">("subscription");
  const [selectedPlan, setSelectedPlan] = useState<PlanId>("pro");
  const [selectedTopup, setSelectedTopup] = useState<TopupId>("medium");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleContinue() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          tab === "subscription"
            ? { kind: "subscription", plan: selectedPlan }
            : { kind: "topup", pack: selectedTopup },
        ),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || "Unable to start checkout. Please try again.");
        return;
      }
      if (data?.url) {
        router.push(data.url);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        role="tablist"
        className="relative flex h-12 shrink-0 items-center rounded-full p-1"
        style={{ backgroundColor: "#262626" }}
      >
        <span
          aria-hidden
          className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-primary transition-transform duration-300 ease-out"
          style={{
            transform: tab === "topup" ? "translateX(100%)" : "translateX(0)",
          }}
        />
        <button
          type="button"
          role="tab"
          aria-selected={tab === "subscription"}
          onClick={() => setTab("subscription")}
          className={`relative flex h-10 flex-1 basis-0 items-center justify-center rounded-full text-[14px] font-semibold transition-colors duration-200 active:opacity-70 ${
            tab === "subscription" ? "text-white" : "text-white/50"
          }`}
        >
          Subscriptions
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "topup"}
          onClick={() => setTab("topup")}
          className={`relative flex h-10 flex-1 basis-0 items-center justify-center rounded-full text-[14px] font-semibold transition-colors duration-200 active:opacity-70 ${
            tab === "topup" ? "text-white" : "text-white/50"
          }`}
        >
          Credits
        </button>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {tab === "subscription"
          ? SUBSCRIPTION_TIERS.map(({ id, badge }) => {
              const plan = PLANS[id];
              const isSelected = selectedPlan === id;
              const tint = isSelected ? "#0285fe" : "rgba(255,255,255,0.15)";
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedPlan(id)}
                  className={`relative flex w-full flex-col rounded-[18px] border-[2.5px] bg-black/30 text-left transition active:opacity-80 ${
                    isSelected ? "border-primary" : "border-white/15"
                  }`}
                >
                  {/* Le badge de remise vit HORS de ce span : c'est lui qui
                      clippe le contenu (icône, barre de prix), pas le
                      bouton entier. Mettre `overflow-hidden` sur le bouton
                      coupait le badge, qui déborde volontairement au-dessus
                      de la carte. */}
                  {badge && (
                    <span className="absolute -top-3 right-2 z-10 whitespace-nowrap rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold leading-4 text-white">
                      {badge}
                    </span>
                  )}
                  <span className="flex w-full flex-col overflow-hidden rounded-[15.5px]">
                    <span className="absolute left-2.5 top-2 z-10 text-[11px] font-semibold uppercase leading-4 tracking-wide text-white/50">
                      {plan.name}
                    </span>
                    <span className="flex aspect-square w-full flex-col items-center justify-center gap-2">
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d={LIGHTNING_PATH} />
                      </svg>
                      <span className="text-[20px] font-bold leading-none tabular-nums text-white">
                        {plan.creditsPerWeek}
                      </span>
                    </span>
                    <span
                      className="relative flex h-8 w-full items-center justify-center text-[14px] font-semibold text-white"
                      style={{ background: tint }}
                    >
                      <PriceCardNotches tint={tint} />
                      {formatPrice(plan.priceUsd)}
                      <span className="ml-1 text-[12px] font-medium">/ wk</span>
                    </span>
                  </span>
                </button>
              );
            })
          : TOPUP_TIERS.map(({ id, badge }) => {
              const pack = TOPUPS[id];
              const isSelected = selectedTopup === id;
              const tint = isSelected ? "#0285fe" : "rgba(255,255,255,0.15)";
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedTopup(id)}
                  className={`relative flex w-full flex-col rounded-[18px] border-[2.5px] bg-black/30 text-left transition active:opacity-80 ${
                    isSelected ? "border-primary" : "border-white/15"
                  }`}
                >
                  {badge && (
                    <span className="absolute -top-3 right-2 z-10 whitespace-nowrap rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold leading-4 text-white">
                      {badge}
                    </span>
                  )}
                  <span className="flex w-full flex-col overflow-hidden rounded-[15.5px]">
                    <span className="flex aspect-square w-full flex-col items-center justify-center gap-2">
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d={LIGHTNING_PATH} />
                      </svg>
                      <span className="text-[20px] font-bold leading-none tabular-nums text-white">
                        {pack.credits}
                      </span>
                    </span>
                    <span
                      className="relative flex h-8 w-full items-center justify-center text-[14px] font-semibold text-white"
                      style={{ background: tint }}
                    >
                      <PriceCardNotches tint={tint} />
                      {formatPrice(pack.priceUsd)}
                    </span>
                  </span>
                </button>
              );
            })}
      </div>

      <ul className="mt-5 flex flex-col gap-2.5">
        {(tab === "subscription" ? SUBSCRIPTION_FEATURES : TOPUP_FEATURES).map(
          (feature) => (
            <li
              key={feature}
              className="flex items-start gap-2.5 text-[14px] font-medium leading-5 text-white"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
                className="mt-[3px] shrink-0"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
              <span>{feature}</span>
            </li>
          ),
        )}
      </ul>

      {error && (
        <p role="alert" className="mt-3 text-[14px] text-red-400">
          {error}
        </p>
      )}

      <div className="mt-auto flex flex-col gap-3 pt-5">
        <button
          type="button"
          onClick={handleContinue}
          disabled={loading}
          className="flex h-14 w-full items-center justify-center rounded-3xl bg-primary text-[17px] font-semibold text-white shadow-[0_0_18px_rgba(2,133,254,0.45),0_0_44px_rgba(2,133,254,0.22)] transition active:opacity-80 disabled:opacity-50"
        >
          {loading ? "Loading…" : "Continue"}
        </button>
        <p className="text-center text-[13px] leading-5 text-white/40">
          {tab === "subscription"
            ? "Billed weekly · Cancel anytime"
            : "One-time payment · No expiration"}
        </p>
      </div>
    </div>
  );
}
