import Link from "next/link";
import { redirect } from "next/navigation";
import Panel from "@/components/Panel";
import SignOutButton from "@/components/SignOutButton";
import ManageSubscriptionButton from "@/components/ManageSubscriptionButton";
import { createClient } from "@/lib/supabase/server";
import { PLANS, type PlanId } from "@/lib/stripe";

export default async function ComptePage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/connexion");
  }

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select("credits, plan, current_period_end")
    .eq("id", user.id)
    .single();

  const planId = profile?.plan as PlanId | null | undefined;
  const planName = planId ? PLANS[planId]?.name : null;
  const renewalDate = profile?.current_period_end
    ? new Date(profile.current_period_end).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : null;

  return (
    <div className="animate-fade-up mx-auto max-w-md py-8">
      <div className="mb-8 text-center">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary">
          Mon compte
        </p>
        <h2 className="font-display mt-3 text-3xl font-semibold leading-tight tracking-tight text-foreground">
          Bienvenue
        </h2>
      </div>

      <Panel className="p-6">
        <dl className="space-y-4 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-[0.1em] text-foreground/50">
              Email
            </dt>
            <dd className="mt-1 text-foreground">{user.email}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.1em] text-foreground/50">
              Palier
            </dt>
            <dd className="mt-1 text-foreground">
              {planName ?? "Aucun abonnement actif"}
            </dd>
          </div>
          {renewalDate && (
            <div>
              <dt className="text-xs uppercase tracking-[0.1em] text-foreground/50">
                Prochain renouvellement
              </dt>
              <dd className="mt-1 text-foreground">{renewalDate}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs uppercase tracking-[0.1em] text-foreground/50">
              Crédits disponibles
            </dt>
            <dd className="mt-1 text-foreground">
              {profileError ? "Impossible de charger ton solde pour le moment." : (profile?.credits ?? 0)}
            </dd>
          </div>
        </dl>

        <div className="mt-6 space-y-3">
          {planId ? (
            <ManageSubscriptionButton />
          ) : (
            <p className="text-center text-sm text-foreground/50">
              <Link
                href="/tarifs"
                className="font-medium text-[var(--link)] underline underline-offset-2 hover:text-primary"
              >
                Voir les paliers
              </Link>{" "}
              pour souscrire un abonnement.
            </p>
          )}
          <SignOutButton />
        </div>
      </Panel>
    </div>
  );
}
