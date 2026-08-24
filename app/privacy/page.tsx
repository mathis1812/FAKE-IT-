import Panel from "@/components/Panel";
import LegalIdentityNotice from "@/components/LegalIdentityNotice";

export default function ConfidentialitePage() {
  return (
    <div className="animate-fade-up mx-auto max-w-3xl py-8">
      <Panel className="p-6 sm:p-8">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary">
          Privacy
        </p>
        <h2 className="font-display mt-3 text-3xl font-semibold leading-tight tracking-tight text-white">
          Privacy policy
        </h2>

        <LegalIdentityNotice />

        <div className="space-y-6 text-sm leading-relaxed text-neutral-400">
          <section>
            <h3 className="mb-2 text-base font-semibold text-neutral-100">
              1. Data controller
            </h3>
            <p>
              The controller responsible for the processing of personal
              data collected on Bluminoo Studio is Mathis Vergne, who can be
              reached at{" "}
              <a
                href="mailto:mathisvergne27@gmail.com"
                className="text-primary-soft underline underline-offset-2 hover:text-primary"
              >
                mathisvergne27@gmail.com
              </a>
              .
            </p>
          </section>

          <section>
            <h3 className="mb-2 text-base font-semibold text-neutral-100">
              2. Data collected
            </h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                Email address and (hashed) password, when an account is
                created.
              </li>
              <li>
                Photos uploaded for image or video generation, temporarily
                transmitted to third-party artificial intelligence
                providers for processing (see section 4).
              </li>
              <li>
                Payment data (card number, etc.), collected and processed
                directly by Stripe — never by Bluminoo Studio.
              </li>
              <li>
                Credit balance and subscription history, associated with
                your account.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="mb-2 text-base font-semibold text-neutral-100">
              3. Purposes of processing
            </h3>
            <p>
              This data is used to: create and secure your account, provide
              the image/video generation service, manage your subscription
              and credit balance, and respond to your support requests.
            </p>
          </section>

          <section>
            <h3 className="mb-2 text-base font-semibold text-neutral-100">
              4. Subprocessors and transfers
            </h3>
            <p>The following providers process data on our behalf:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <strong>Supabase</strong> — database hosting and account
                authentication.
              </li>
              <li>
                <strong>Vercel</strong> — application hosting.
              </li>
              <li>
                <strong>Stripe</strong> — payment and card data processing.
              </li>
              <li>
                <strong>kie.ai</strong> — generation of images (Nano Banana
                Pro / Gemini 3 Pro Image) and videos (Kling 3.0), and
                temporary hosting of the photos provided while processing
                is underway.
              </li>
            </ul>
            <p className="mt-2">
              Some of these providers may be located outside the European
              Union (in particular in the United States); any resulting
              data transfer relies on the safeguards provided by these
              providers (standard contractual clauses or equivalent).
            </p>
          </section>

          <section>
            <h3 className="mb-2 text-base font-semibold text-neutral-100">
              5. Retention period
            </h3>
            <p>
              Account data is retained for as long as the account remains
              active. Photos uploaded for a generation are transmitted to
              AI providers for the duration of processing and are not
              retained by Bluminoo Studio beyond that operation. Successful
              generation results (images and videos) are stored in your
              Gallery, associated with your account, until your account is
              deleted or you request their removal.
            </p>
          </section>

          <section>
            <h3 className="mb-2 text-base font-semibold text-neutral-100">
              6. Your rights
            </h3>
            <p>
              In accordance with the GDPR, you have the right to access,
              rectify, erase, restrict, and object to the processing of
              your personal data, as well as a right to data portability.
              You may exercise these rights by contacting us at{" "}
              <a
                href="mailto:mathisvergne27@gmail.com"
                className="text-primary-soft underline underline-offset-2 hover:text-primary"
              >
                mathisvergne27@gmail.com
              </a>
              . You also have the right to lodge a complaint with the CNIL
              (www.cnil.fr).
            </p>
          </section>

          <section>
            <h3 className="mb-2 text-base font-semibold text-neutral-100">
              7. Cookies
            </h3>
            <p>
              The site only uses technical cookies that are strictly
              necessary for the service to function (maintaining your login
              session via Supabase). No advertising or third-party tracking
              cookies are used.
            </p>
          </section>
        </div>
      </Panel>
    </div>
  );
}
