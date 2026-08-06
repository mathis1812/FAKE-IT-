import Panel from "@/components/Panel";
import SubscribeButton from "@/components/SubscribeButton";
import ManageSubscriptionButton from "@/components/ManageSubscriptionButton";
import { createClient } from "@/lib/supabase/server";
import { PLANS, type PlanId } from "@/lib/stripe";

const PLAN_ORDER: PlanId[] = ["decouverte", "essentiel", "ultimate"];

const PLAN_FEATURES: Record<PlanId, string[]> = {
  decouverte: [
    "Génération photo & vidéo",
    "Presets Montre / Voiture / Lieu",
    "Historique complet",
  ],
  essentiel: [
    "Génération photo & vidéo",
    "Presets Montre / Voiture / Lieu",
    "Historique complet",
    "Support prioritaire",
  ],
  ultimate: [
    "Génération photo & vidéo",
    "Presets Montre / Voiture / Lieu",
    "Historique complet",
    "Support prioritaire",
    "12 000 crédits/mois (plafonné)",
  ],
};

export default async function TarifsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let currentPlan: PlanId | null = null;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .single();
    currentPlan = (profile?.plan as PlanId | null) ?? null;
  }

  return (
    <div className="animate-fade-up mx-auto max-w-5xl py-8">
      <div className="mb-8 text-center">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary">
          Tarifs
        </p>
        <h2 className="font-display mt-3 text-3xl font-semibold leading-tight tracking-tight text-white">
          Des tarifs simples, pensés pour créer sans limite.
        </h2>
        <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 p-1 text-xs font-semibold uppercase tracking-[0.1em]">
          <span className="rounded-full bg-primary px-4 py-1.5 text-ink">
            Mensuel
          </span>
          <span className="cursor-not-allowed rounded-full px-4 py-1.5 text-neutral-600">
            Annuel · Bientôt disponible
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        {PLAN_ORDER.map((planId) => {
          const plan = PLANS[planId];
          const isCurrent = currentPlan === planId;
          return (
            <Panel key={planId} className="flex flex-col p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-xl font-semibold text-white">
                  {plan.name}
                </h3>
                {isCurrent && (
                  <span className="rounded-full bg-primary/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary-soft">
                    Plan actuel
                  </span>
                )}
              </div>
              <p className="mb-1 text-3xl font-semibold text-white">
                {plan.priceEur.toFixed(2).replace(".", ",")} €
                <span className="text-sm font-normal text-neutral-500">
                  /mois
                </span>
              </p>
              <p className="mb-4 text-sm text-neutral-400">
                {plan.credits.toLocaleString("fr-FR")} crédits/mois
              </p>
              <ul className="mb-6 flex-1 space-y-2.5 text-sm text-neutral-400">
                {PLAN_FEATURES[planId].map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-primary" />
                    {feature}
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <div className="rounded-2xl border border-white/10 px-4 py-3 text-center text-sm font-medium text-neutral-500">
                  Ton palier actuel
                </div>
              ) : currentPlan ? (
                <ManageSubscriptionButton />
              ) : (
                <SubscribeButton plan={planId} isLoggedIn={!!user} />
              )}
            </Panel>
          );
        })}
      </div>

      {currentPlan && (
        <div className="mt-8">
          <ManageSubscriptionButton />
        </div>
      )}
    </div>
  );
}
