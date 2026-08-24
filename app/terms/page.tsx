import Panel from "@/components/Panel";
import LegalIdentityNotice from "@/components/LegalIdentityNotice";

export default function CgvPage() {
  return (
    <div className="animate-fade-up mx-auto max-w-3xl py-8">
      <Panel className="p-6 sm:p-8">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary">
          Terms of sale
        </p>
        <h2 className="font-display mt-3 text-3xl font-semibold leading-tight tracking-tight text-white">
          General terms and conditions of sale
        </h2>

        <LegalIdentityNotice />

        <div className="space-y-6 text-sm leading-relaxed text-neutral-400">
          <section>
            <h3 className="mb-2 text-base font-semibold text-neutral-100">
              1. Purpose
            </h3>
            <p>
              These general terms and conditions of sale (&quot;Terms&quot;)
              govern subscription to the paid offers of Bluminoo Studio, an
              online service that generates images and videos using
              artificial intelligence from photos supplied by the user.
            </p>
          </section>

          <section>
            <h3 className="mb-2 text-base font-semibold text-neutral-100">
              2. Offers and pricing
            </h3>
            <p>
              Bluminoo Studio offers three subscription tiers, billed either
              monthly or annually, as the user prefers (the annual offer
              carries a discount of roughly 20% compared with the monthly
              rate, billed in a single payment):
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                Starter: $9.99 / month or $95.90 / year — 2,000 credits /
                month
              </li>
              <li>
                Essential: $19.99 / month or $191.90 / year — 5,000 credits /
                month
              </li>
              <li>
                Ultimate: $39.99 / month or $383.90 / year — 12,000 credits /
                month
              </li>
            </ul>
            <p className="mt-2">
              For an annual subscription, the credits corresponding to the
              full year are credited in a single batch upon payment, then
              reloaded identically at the next annual renewal.
            </p>
            <p className="mt-2">
              Credits are consumed on each successful generation (image or
              video) and are reset and reloaded at each renewal of the
              subscription period. Credits not used by the end of a period
              are neither carried over nor refunded. Prices are shown in US
              dollars, all taxes included.
            </p>
          </section>

          <section>
            <h3 className="mb-2 text-base font-semibold text-neutral-100">
              3. Payment and renewal
            </h3>
            <p>
              Payment is made by credit card via the Stripe payment
              processor, which handles card data directly — Bluminoo Studio
              never has access to the card number. The subscription is for
              an indefinite term and renews automatically each month by
              charging the same card, until cancellation.
            </p>
          </section>

          <section>
            <h3 className="mb-2 text-base font-semibold text-neutral-100">
              4. Cancellation
            </h3>
            <p>
              The user may cancel their subscription at any time from their
              billing area (accessible via the account page). Cancellation
              takes effect at the end of the current period already paid
              for; no pro-rata refund is issued for the current period.
            </p>
          </section>

          <section>
            <h3 className="mb-2 text-base font-semibold text-neutral-100">
              5. Right of withdrawal
            </h3>
            <p>
              In accordance with Article L221-28 of the French Consumer
              Code, the right of withdrawal cannot be exercised for digital
              content supplied on a non-material medium whose performance
              has begun after the consumer&apos;s prior express consent, and
              who has also waived their right of withdrawal. By subscribing
              to a paid offer, the user acknowledges that access to credits
              is immediate and expressly waives their right of withdrawal
              from the first use of credits.
            </p>
          </section>

          <section>
            <h3 className="mb-2 text-base font-semibold text-neutral-100">
              6. Liability
            </h3>
            <p>
              Generated content (images, videos) is produced by third-party
              artificial intelligence models and may contain imperfections,
              inaccuracies, or fail to fully match the request. Bluminoo
              Studio does not guarantee any specific result and cannot be
              held liable for any use of the generated content that
              violates the law or the rights of third parties (image
              rights, intellectual property, trademark infringement, etc.),
              which is the sole responsibility of the user.
            </p>
          </section>

          <section>
            <h3 className="mb-2 text-base font-semibold text-neutral-100">
              7. Governing law and disputes
            </h3>
            <p>
              These Terms are governed by French law. In the event of a
              dispute, the user may resort to consumer mediation before any
              legal action. Failing an amicable resolution, the French
              courts shall have sole jurisdiction.
            </p>
          </section>

          <section>
            <h3 className="mb-2 text-base font-semibold text-neutral-100">
              8. Contact
            </h3>
            <p>
              For any question regarding these Terms:{" "}
              <a
                href="mailto:mathisvergne27@gmail.com"
                className="text-primary-soft underline underline-offset-2 hover:text-primary"
              >
                mathisvergne27@gmail.com
              </a>
            </p>
          </section>
        </div>
      </Panel>
    </div>
  );
}
