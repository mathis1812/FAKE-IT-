import Panel from "@/components/Panel";
import LegalIdentityNotice from "@/components/LegalIdentityNotice";

export default function ConfidentialitePage() {
  return (
    <div className="animate-fade-up mx-auto max-w-3xl py-8">
      <Panel className="p-6 sm:p-8">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary">
          Confidentialité
        </p>
        <h2 className="font-display mt-3 text-3xl font-semibold leading-tight tracking-tight text-foreground">
          Politique de confidentialité
        </h2>

        <LegalIdentityNotice />

        <div className="space-y-6 text-sm leading-relaxed text-foreground/65">
          <section>
            <h3 className="mb-2 text-base font-semibold text-foreground">
              1. Responsable du traitement
            </h3>
            <p>
              Le responsable du traitement des données à caractère personnel
              collectées sur Bluminoo Studio est Mathis Vergne, joignable à{" "}
              <a
                href="mailto:mathisvergne27@gmail.com"
                className="text-[var(--link)] underline underline-offset-2 hover:text-primary"
              >
                mathisvergne27@gmail.com
              </a>
              .
            </p>
          </section>

          <section>
            <h3 className="mb-2 text-base font-semibold text-foreground">
              2. Données collectées
            </h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                Adresse e-mail et mot de passe (haché), lors de la création
                d&apos;un compte.
              </li>
              <li>
                Photos uploadées pour la génération d&apos;images ou de
                vidéos, transmises temporairement à des prestataires
                d&apos;intelligence artificielle tiers pour traitement (voir
                section 4).
              </li>
              <li>
                Données de paiement (numéro de carte, etc.), collectées et
                traitées directement par Stripe — jamais par Bluminoo
                Studio.
              </li>
              <li>
                Solde de crédits et historique d&apos;abonnement, associés à
                votre compte.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="mb-2 text-base font-semibold text-foreground">
              3. Finalités du traitement
            </h3>
            <p>
              Ces données sont utilisées pour : créer et sécuriser votre
              compte, fournir le service de génération d&apos;images/vidéos,
              gérer votre abonnement et votre solde de crédits, et
              répondre à vos demandes de support.
            </p>
          </section>

          <section>
            <h3 className="mb-2 text-base font-semibold text-foreground">
              4. Sous-traitants et transferts
            </h3>
            <p>Les prestataires suivants traitent des données pour notre compte :</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <strong>Supabase</strong> — hébergement de la base de données
                et authentification des comptes.
              </li>
              <li>
                <strong>Vercel</strong> — hébergement de l&apos;application.
              </li>
              <li>
                <strong>Stripe</strong> — traitement des paiements et des
                données bancaires.
              </li>
              <li>
                <strong>kie.ai</strong> — génération des images (Nano Banana
                Pro / Gemini 3 Pro Image) et des vidéos (Kling 3.0), et
                hébergement temporaire des photos fournies le temps du
                traitement.
              </li>
            </ul>
            <p className="mt-2">
              Certains de ces prestataires peuvent être situés hors de
              l&apos;Union européenne (notamment aux États-Unis) ; le
              transfert de données s&apos;appuie alors sur les garanties
              prévues par ces prestataires (clauses contractuelles types ou
              équivalent).
            </p>
          </section>

          <section>
            <h3 className="mb-2 text-base font-semibold text-foreground">
              5. Durée de conservation
            </h3>
            <p>
              Les données de compte sont conservées tant que le compte est
              actif. Les photos uploadées pour une génération sont
              transmises aux prestataires d&apos;IA le temps du traitement et
              ne sont pas conservées durablement par Bluminoo Studio au-delà
              de cette opération. Les résultats de génération réussis
              (images et vidéos) sont conservés dans votre Galerie, associée
              à votre compte, jusqu&apos;à suppression de votre compte ou
              demande de votre part.
            </p>
          </section>

          <section>
            <h3 className="mb-2 text-base font-semibold text-foreground">
              6. Vos droits
            </h3>
            <p>
              Conformément au RGPD, vous disposez d&apos;un droit
              d&apos;accès, de rectification, d&apos;effacement, de limitation
              et d&apos;opposition concernant vos données personnelles, ainsi
              que d&apos;un droit à la portabilité. Vous pouvez exercer ces
              droits en nous contactant à{" "}
              <a
                href="mailto:mathisvergne27@gmail.com"
                className="text-[var(--link)] underline underline-offset-2 hover:text-primary"
              >
                mathisvergne27@gmail.com
              </a>
              . Vous disposez également du droit d&apos;introduire une
              réclamation auprès de la CNIL (www.cnil.fr).
            </p>
          </section>

          <section>
            <h3 className="mb-2 text-base font-semibold text-foreground">
              7. Cookies
            </h3>
            <p>
              Le site utilise uniquement des cookies techniques strictement
              nécessaires au fonctionnement du service (maintien de votre
              session de connexion via Supabase). Aucun cookie publicitaire
              ou de traçage tiers n&apos;est utilisé.
            </p>
          </section>
        </div>
      </Panel>
    </div>
  );
}
