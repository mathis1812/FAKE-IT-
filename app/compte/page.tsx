import Link from "next/link";
import { redirect } from "next/navigation";
import Panel from "@/components/Panel";
import AccountStatCard from "@/components/AccountStatCard";
import SignOutButton from "@/components/SignOutButton";
import ManageSubscriptionButton from "@/components/ManageSubscriptionButton";
import { createClient } from "@/lib/supabase/server";
import { PLANS, type PlanId } from "@/lib/stripe";

const SUPPORT_EMAIL = "mathisvergne27@gmail.com";
const PRIORITY_PLANS: readonly PlanId[] = ["essentiel", "ultimate"];

/**
 * « Support prioritaire » n'a d'existence réelle que par ce que ce lien
 * porte : sur Essentiel/Ultimate, l'objet et le corps du mail signalent le
 * palier et le compte, pour un tri immédiat sans aller-retour — c'est la
 * seule différence tangible avec un compte gratuit, qui garde un accès au
 * support mais sans cette priorisation.
 */
function buildSupportMailto(
  isPriority: boolean,
  planName: string | null,
  email: string,
): string {
  const subject = isPriority
    ? `[Support prioritaire] ${planName} — ${email}`
    : `[Support] ${email}`;
  const body = isPriority
    ? `Bonjour,\n\nPalier : ${planName}\nCompte : ${email}\n\nDécris ta demande ici :\n`
    : `Bonjour,\n\nCompte : ${email}\n\nDécris ta demande ici :\n`;
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

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
  const isPriority = !!planId && PRIORITY_PLANS.includes(planId);
  const supportMailto = buildSupportMailto(
    isPriority,
    planName,
    user.email ?? "",
  );
  const renewalDate = profile?.current_period_end
    ? new Date(profile.current_period_end).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : null;

  return (
    <div className="animate-fade-up mx-auto max-w-4xl py-8">
      <div className="mb-8 text-center">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary">
          Mon compte
        </p>
        <h2 className="font-display mt-3 text-3xl font-semibold leading-tight tracking-tight text-white">
          Bienvenue
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Panel className="p-6">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary-soft">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden
                >
                  <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8" />
                  <path
                    d="M4 20c0-4 3.6-7 8-7s8 3 8 7"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Informations Personnelles
                </h3>
                <p className="text-xs text-neutral-500">
                  Vos données de base sur Bluminoo Studio.
                </p>
              </div>
            </div>

            <dl className="mt-6 space-y-4 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-[0.1em] text-neutral-500">
                  Email
                </dt>
                <dd className="mt-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-white">
                  {user.email}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.1em] text-neutral-500">
                  Rôle
                </dt>
                <dd className="mt-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-white">
                  User
                </dd>
              </div>
            </dl>
          </Panel>

          <Panel className="p-6">
            <h3 className="text-sm font-semibold text-white">
              Recharger mes crédits
            </h3>
            <p className="mt-1 text-xs text-neutral-500">
              Renouvelle ton abonnement pour recharger tes crédits, ou passe à
              un palier supérieur pour débloquer une meilleure résolution.
            </p>
            <Link
              href="/tarifs"
              className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-ink transition hover:bg-primary-soft"
            >
              Voir les paliers
            </Link>
          </Panel>

          <Panel className="p-6">
            <h3 className="text-sm font-semibold text-white">
              {isPriority ? "Support prioritaire" : "Besoin d'aide ?"}
            </h3>
            <p className="mt-1 text-xs text-neutral-500">
              {isPriority
                ? "Ton message est signalé comme prioritaire, avec ton palier et ton compte déjà renseignés — pas besoin de tout réexpliquer."
                : "Écris-nous, on te répond dès que possible. Le support prioritaire (réponse en tête de file) est réservé aux paliers Essentiel et Ultimate."}
            </p>
            <a
              href={supportMailto}
              className="mt-4 inline-flex w-full items-center justify-center rounded-2xl border border-primary/40 px-4 py-3 text-sm font-semibold text-primary-soft transition hover:border-primary hover:text-primary"
            >
              Contacter le support
            </a>
          </Panel>
        </div>

        <div className="space-y-6">
          <AccountStatCard
            title="Crédits"
            icon={
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden
              >
                <ellipse cx="12" cy="6" rx="7" ry="3" stroke="currentColor" strokeWidth="1.8" />
                <path
                  d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <path
                  d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            }
          >
            <p
              className={
                profileError
                  ? "text-sm font-medium text-neutral-400"
                  : "text-3xl font-semibold text-white"
              }
            >
              {profileError
                ? "Impossible de charger ton solde pour le moment."
                : profile?.credits ?? 0}
            </p>
            {!profileError && (
              <p className="mt-1 text-xs text-neutral-500">crédits restants</p>
            )}
          </AccountStatCard>

          <AccountStatCard
            title="Abonnement"
            icon={
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden
              >
                <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
                <path d="M3 10h18" stroke="currentColor" strokeWidth="1.8" />
              </svg>
            }
          >
            <p className="text-xl font-semibold text-white">
              {planName ?? "Plan Gratuit"}
            </p>
            {renewalDate && (
              <p className="mt-1 text-xs text-neutral-500">
                Renouvellement le {renewalDate}
              </p>
            )}
            <div className="mt-4">
              {planId ? (
                <ManageSubscriptionButton />
              ) : (
                <Link
                  href="/tarifs"
                  className="flex w-full items-center justify-center rounded-2xl border border-primary/40 px-4 py-3 text-sm font-semibold text-primary-soft transition hover:border-primary hover:text-primary"
                >
                  Voir les offres
                </Link>
              )}
            </div>
          </AccountStatCard>
        </div>
      </div>

      <div className="mx-auto mt-6 max-w-md">
        <SignOutButton />
      </div>
    </div>
  );
}
