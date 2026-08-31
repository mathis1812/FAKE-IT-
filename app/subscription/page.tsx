"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import TemplateHeader from "@/components/TemplateHeader";
import { createClient } from "@/lib/supabase/client";
import { asPlanId, PLAN_ORDER, QUALITY_COST } from "@/lib/generation-tiers";
import {
  PLANS,
  TOPUPS,
  formatPrice,
  type PlanId,
  type TopupId,
} from "@/lib/stripe";

/**
 * Écran de gestion de l'abonnement — l'équivalent de `/abonnement` sur le
 * modèle, relevé en lisant son DOM le 31/08 lors du recensement page par
 * page. C'était le seul écran du modèle sans aucune contrepartie ici :
 * `/pricing` ne sert qu'à *souscrire*, et la feuille de compte se limitait
 * à quatre entrées. Un abonné n'avait donc nulle part où voir sa formule,
 * sa date de renouvellement, ni changer de palier.
 *
 * Tout le service existait déjà côté serveur : `/api/stripe/portal` (à vide
 * pour le portail Stripe, avec `targetPlan` pour changer de formule) et
 * `/api/stripe/checkout` (`kind: "topup"`) pour les packs. Cet écran n'est
 * que leur façade — aucune route nouvelle.
 */

/**
 * Estimation en photos. Le modèle divise toujours par le coût du 1K, quel
 * que soit le palier — vérifié sur ses propres chiffres : 1550 crédits →
 * « ≈ 15 photos » et 2250 → « ≈ 22 » (soit /100), et non par le coût réel
 * du 2K de la formule affichée, qui aurait donné 15 pour 2250.
 */
function photosFor(credits: number): number {
  return Math.floor(credits / QUALITY_COST.normal);
}

function formatRenewal(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { day: "numeric", month: "long" });
}

/** Encadré commun à toutes les sections, repris tel quel du modèle. */
const CARD =
  "rounded-3xl border-[1.5px] border-white/15 bg-black/30 p-4 flex flex-col";
const ACTION_BUTTON =
  "flex h-12 w-full items-center justify-center rounded-2xl border-[1.5px] border-white/15 bg-black/30 text-[16px] font-medium text-white transition active:opacity-70 disabled:opacity-40";

export default function SubscriptionPage() {
  const [credits, setCredits] = useState<number | null>(null);
  const [planId, setPlanId] = useState<PlanId | null>(null);
  const [renewal, setRenewal] = useState<string | null>(null);
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");

  /**
   * Écran de compte personnel : sans session, il n'a rien à montrer. Il
   * affichait « 0 credits » et « No active subscription » à un visiteur
   * déconnecté — un solde faux plutôt qu'absent — et ses boutons Top up ne
   * pouvaient que retomber sur l'erreur brute « Sign in to continue. »,
   * sans offrir de s'y connecter. Même redirection que /settings et
   * /gallery, qui sont dans le même cas.
   */
  useEffect(() => {
    const supabase = createClient();
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/sign-in");
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("credits, plan, current_period_end")
        .eq("id", user.id)
        .single();
      setCredits(data?.credits ?? 0);
      setPlanId(asPlanId(data?.plan as string | null));
      setRenewal(
        formatRenewal((data?.current_period_end as string | null) ?? null),
      );
      setLoaded(true);
    })();
  }, [router]);

  /**
   * Les trois actions partagent la même mécanique : demander une URL au
   * serveur puis quitter l'app. `window.location.href` et non le routeur de
   * Next — il ne sait pas naviguer hors du site (bug déjà rencontré sur le
   * catalogue tarifaire, où le bouton ne faisait rien).
   */
  const goToStripe = useCallback(
    async (key: string, endpoint: string, body: Record<string, string>) => {
      setPending(key);
      setError("");
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.url) {
          setError(data?.error || "Something went wrong. Please try again.");
          return;
        }
        window.location.href = data.url;
      } catch {
        setError("Network error. Please try again.");
      } finally {
        setPending(null);
      }
    },
    [],
  );

  const plan = planId ? PLANS[planId] : null;
  const nextPlanId: PlanId | null = planId
    ? (PLAN_ORDER[PLAN_ORDER.indexOf(planId) + 1] ?? null)
    : null;
  const nextPlan = nextPlanId ? PLANS[nextPlanId] : null;

  // Barre de progression : part du forfait hebdomadaire encore disponible.
  // Plafonnée à 100% — un pack de crédits peut faire dépasser le forfait,
  // et une barre à 140% déborderait de son rail.
  const progress =
    plan && credits !== null
      ? Math.min(100, Math.round((credits / plan.creditsPerWeek) * 100))
      : 0;

  return (
    <>
      <TemplateHeader backHref="/" title="Subscription" />

      <main className="flex min-h-dvh flex-col gap-3 bg-black px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-[calc(env(safe-area-inset-top)+76px)]">
        {/* Solde, avec la jauge du forfait hebdomadaire. */}
        <section className={`${CARD} gap-2`}>
          <span className="flex items-center gap-2 text-[22px] font-semibold leading-tight text-white">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
            </svg>
            {loaded ? (credits ?? 0).toLocaleString("en-US") : "—"} credits
            {loaded && credits !== null && (
              <span className="text-[13px] font-medium text-white/50">
                ≈ {photosFor(credits)} photos
              </span>
            )}
          </span>
          {plan && (
            <div
              role="presentation"
              className="h-1.5 w-full overflow-hidden rounded-full bg-white/10"
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </section>

        {/* Formule en cours, ou invitation à s'abonner. */}
        {plan ? (
          <section className={`${CARD} gap-1`}>
            <span className="text-[13px] font-semibold uppercase tracking-wide text-white/40">
              Your plan
            </span>
            <span className="flex items-baseline justify-between gap-3">
              <span className="text-[17px] font-medium text-white">
                {formatPrice(plan.priceUsd)}
                <span className="text-[13px] text-white/50"> / week</span>
              </span>
              <span className="text-[13px] leading-5 text-white/50">
                {plan.creditsPerWeek.toLocaleString("en-US")} credits · ≈{" "}
                {photosFor(plan.creditsPerWeek)} photos
              </span>
            </span>
            {renewal && (
              <span className="text-[13px] leading-5 text-white/50">
                Next top-up on {renewal}
              </span>
            )}
          </section>
        ) : (
          loaded && (
            <section className={`${CARD} gap-3`}>
              <span className="text-[17px] font-medium text-white">
                No active subscription
              </span>
              <span className="text-[13px] leading-5 text-white/50">
                Subscribe to unlock higher resolutions, video and Red Snap.
              </span>
              <Link href="/pricing" className={ACTION_BUTTON}>
                See the plans
              </Link>
            </section>
          )
        )}

        {/* Montée en gamme, seulement s'il reste un palier au-dessus. */}
        {plan && nextPlan && nextPlanId && (
          <section className={`${CARD} gap-3`}>
            <span className="text-[17px] font-medium text-white">
              +
              {(nextPlan.creditsPerWeek - plan.creditsPerWeek).toLocaleString(
                "en-US",
              )}{" "}
              credits <span className="text-[13px] text-white/50">/ week</span>{" "}
              for {formatPrice(nextPlan.priceUsd - plan.priceUsd)} more
            </span>
            <span className="text-[13px] leading-5 text-white/50">
              {formatPrice(nextPlan.priceUsd)} / week ·{" "}
              {nextPlan.creditsPerWeek.toLocaleString("en-US")} credits · ≈{" "}
              {photosFor(nextPlan.creditsPerWeek)} photos
            </span>
            <button
              type="button"
              disabled={pending !== null}
              onClick={() =>
                goToStripe("upgrade", "/api/stripe/portal", {
                  targetPlan: nextPlanId,
                })
              }
              className={ACTION_BUTTON}
            >
              {pending === "upgrade" ? "Opening…" : "Change plan"}
            </button>
            <span className="text-[13px] leading-5 text-white/50">
              Takes effect immediately, prorated for the current week.
            </span>
          </section>
        )}

        {/* Packs de crédits — achetables abonné ou non. */}
        {(Object.keys(TOPUPS) as TopupId[]).map((packId) => {
          const pack = TOPUPS[packId];
          return (
            <section key={packId} className={`${CARD} gap-3`}>
              <span className="flex items-baseline justify-between gap-3">
                <span className="text-[17px] font-medium text-white">
                  {pack.credits.toLocaleString("en-US")} credits
                  <span className="text-[13px] text-white/50">
                    {" "}
                    — {formatPrice(pack.priceUsd)}
                  </span>
                </span>
                <span className="text-[13px] leading-5 text-white/50">
                  never expires
                </span>
              </span>
              <button
                type="button"
                disabled={pending !== null}
                onClick={() =>
                  goToStripe(packId, "/api/stripe/checkout", {
                    kind: "topup",
                    pack: packId,
                  })
                }
                className={ACTION_BUTTON}
              >
                {pending === packId ? "Opening…" : "Top up"}
              </button>
            </section>
          );
        })}

        {error && (
          <p role="alert" className="px-2 text-center text-[14px] text-red-400">
            {error}
          </p>
        )}

        {plan && (
          <button
            type="button"
            disabled={pending !== null}
            onClick={() => goToStripe("portal", "/api/stripe/portal", {})}
            className="mt-1 self-center py-2 text-base text-white/60 underline underline-offset-4 transition active:opacity-70 disabled:opacity-40"
          >
            {pending === "portal" ? "Opening…" : "Manage my subscription"}
          </button>
        )}

        <p className="px-2 pt-1 text-center text-[13px] leading-5 text-white/40">
          Subscription credits reset at each renewal and do not carry over.
          Top-up credits are kept with no time limit.
        </p>
      </main>
    </>
  );
}
