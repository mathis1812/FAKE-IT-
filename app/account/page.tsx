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
 * "Priority support" only really exists through what this link carries: on
 * Essential/Ultimate, the email subject and body flag the plan and the
 * account up front, for instant triage with no back-and-forth — that's the
 * one tangible difference from a free account, which keeps support access
 * but without this prioritization.
 */
function buildSupportMailto(
  isPriority: boolean,
  planName: string | null,
  email: string,
): string {
  const subject = isPriority
    ? `[Priority support] ${planName} — ${email}`
    : `[Support] ${email}`;
  const body = isPriority
    ? `Hi,\n\nPlan: ${planName}\nAccount: ${email}\n\nDescribe your request here:\n`
    : `Hi,\n\nAccount: ${email}\n\nDescribe your request here:\n`;
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default async function AccountPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
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
    ? new Date(profile.current_period_end).toLocaleDateString("en-US", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : null;

  return (
    <div className="animate-fade-up mx-auto max-w-4xl py-8">
      <div className="mb-8 text-center">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary">
          My account
        </p>
        <h2 className="font-display mt-3 text-3xl font-semibold leading-tight tracking-tight text-white">
          Welcome back
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
                  Personal Information
                </h3>
                <p className="text-xs text-neutral-500">
                  Your basic details on Bluminoo Studio.
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
                  Role
                </dt>
                <dd className="mt-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-white">
                  User
                </dd>
              </div>
            </dl>
          </Panel>

          <Panel className="p-6">
            <h3 className="text-sm font-semibold text-white">
              Top up your credits
            </h3>
            <p className="mt-1 text-xs text-neutral-500">
              Renew your subscription to top up your credits, or move up a
              plan to unlock a higher resolution.
            </p>
            <Link
              href="/pricing"
              className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-ink transition hover:bg-primary-soft"
            >
              See plans
            </Link>
          </Panel>

          <Panel className="p-6">
            <h3 className="text-sm font-semibold text-white">
              {isPriority ? "Priority support" : "Need help?"}
            </h3>
            <p className="mt-1 text-xs text-neutral-500">
              {isPriority
                ? "Your message is flagged as priority, with your plan and account already filled in — no need to explain it all again."
                : "Write to us and we'll get back to you as soon as possible. Priority support (front-of-queue reply) is reserved for the Essential and Ultimate plans."}
            </p>
            <a
              href={supportMailto}
              className="mt-4 inline-flex w-full items-center justify-center rounded-2xl border border-primary/40 px-4 py-3 text-sm font-semibold text-primary-soft transition hover:border-primary hover:text-primary"
            >
              Contact support
            </a>
          </Panel>
        </div>

        <div className="space-y-6">
          <AccountStatCard
            title="Credits"
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
                ? "Unable to load your balance right now."
                : profile?.credits ?? 0}
            </p>
            {!profileError && (
              <p className="mt-1 text-xs text-neutral-500">credits remaining</p>
            )}
          </AccountStatCard>

          <AccountStatCard
            title="Subscription"
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
              {planName ?? "Free Plan"}
            </p>
            {renewalDate && (
              <p className="mt-1 text-xs text-neutral-500">
                Renews on {renewalDate}
              </p>
            )}
            <div className="mt-4">
              {planId ? (
                <ManageSubscriptionButton />
              ) : (
                <Link
                  href="/pricing"
                  className="flex w-full items-center justify-center rounded-2xl border border-primary/40 px-4 py-3 text-sm font-semibold text-primary-soft transition hover:border-primary hover:text-primary"
                >
                  See plans
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
