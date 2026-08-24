import Panel from "@/components/Panel";
import LegalIdentityNotice from "@/components/LegalIdentityNotice";

export default function MentionsLegalesPage() {
  return (
    <div className="animate-fade-up mx-auto max-w-3xl py-8">
      <Panel className="p-6 sm:p-8">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary">
          Legal information
        </p>
        <h2 className="font-display mt-3 text-3xl font-semibold leading-tight tracking-tight text-white">
          Legal notice
        </h2>

        <LegalIdentityNotice />

        <div className="space-y-6 text-sm leading-relaxed text-neutral-400">
          <section>
            <h3 className="mb-2 text-base font-semibold text-neutral-100">
              1. Site publisher
            </h3>
            <p>
              The Bluminoo Studio site is published by Mathis Vergne, as an
              individual.
              <br />
              Legal form: <em>re-registration in progress</em>
              <br />
              SIRET number: <em>re-registration in progress</em>
              <br />
              Address: <em>currently being updated</em>
              <br />
              Contact:{" "}
              <a
                href="mailto:mathisvergne27@gmail.com"
                className="text-primary-soft underline underline-offset-2 hover:text-primary"
              >
                mathisvergne27@gmail.com
              </a>
            </p>
            <p className="mt-2">Publication director: Mathis Vergne.</p>
          </section>

          <section>
            <h3 className="mb-2 text-base font-semibold text-neutral-100">
              2. Hosting
            </h3>
            <p>
              The site is hosted by Vercel Inc., 340 S Lemon Ave #4133,
              Walnut, CA 91789, United States.
            </p>
            <p className="mt-2">
              The database and authentication are managed by Supabase Inc.
            </p>
          </section>

          <section>
            <h3 className="mb-2 text-base font-semibold text-neutral-100">
              3. Intellectual property
            </h3>
            <p>
              All elements of the site (text, layout, logo, visual identity)
              are protected under copyright law. Any reproduction without
              prior authorization is prohibited.
            </p>
          </section>

          <section>
            <h3 className="mb-2 text-base font-semibold text-neutral-100">
              4. Generation by artificial intelligence
            </h3>
            <p>
              The images and videos produced by the service are generated
              automatically by third-party artificial intelligence models
              accessible via kie.ai (Nano Banana Pro / Gemini 3 Pro Image
              for images, Kling 3.0 for video) from the photos and
              instructions supplied by the user. Bluminoo Studio does not
              guarantee the accuracy, compliance, or error-free nature of
              the generated content.
            </p>
          </section>

          <section>
            <h3 className="mb-2 text-base font-semibold text-neutral-100">
              5. Contact
            </h3>
            <p>
              For any question regarding the site or this legal notice:{" "}
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
