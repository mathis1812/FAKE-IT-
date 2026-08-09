import Panel from "@/components/Panel";
import LegalIdentityNotice from "@/components/LegalIdentityNotice";

export default function MentionsLegalesPage() {
  return (
    <div className="animate-fade-up mx-auto max-w-3xl py-8">
      <Panel className="p-6 sm:p-8">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary">
          Informations légales
        </p>
        <h2 className="font-display mt-3 text-3xl font-semibold leading-tight tracking-tight text-foreground">
          Mentions légales
        </h2>

        <LegalIdentityNotice />

        <div className="space-y-6 text-sm leading-relaxed text-foreground/65">
          <section>
            <h3 className="mb-2 text-base font-semibold text-foreground">
              1. Éditeur du site
            </h3>
            <p>
              Le site Bluminoo Studio est édité par Mathis Vergne, à titre
              individuel.
              <br />
              Forme juridique : <em>en cours de réimmatriculation</em>
              <br />
              Numéro SIRET : <em>en cours de réimmatriculation</em>
              <br />
              Adresse : <em>en cours de mise à jour</em>
              <br />
              Contact :{" "}
              <a
                href="mailto:mathisvergne27@gmail.com"
                className="text-[var(--link)] underline underline-offset-2 hover:text-primary"
              >
                mathisvergne27@gmail.com
              </a>
            </p>
            <p className="mt-2">
              Directeur de la publication : Mathis Vergne.
            </p>
          </section>

          <section>
            <h3 className="mb-2 text-base font-semibold text-foreground">
              2. Hébergement
            </h3>
            <p>
              Le site est hébergé par Vercel Inc., 340 S Lemon Ave #4133,
              Walnut, CA 91789, États-Unis.
            </p>
            <p className="mt-2">
              La base de données et l&apos;authentification sont gérées par
              Supabase Inc.
            </p>
          </section>

          <section>
            <h3 className="mb-2 text-base font-semibold text-foreground">
              3. Propriété intellectuelle
            </h3>
            <p>
              L&apos;ensemble des éléments du site (textes, mise en page,
              logo, charte graphique) est protégé au titre du droit
              d&apos;auteur. Toute reproduction sans autorisation préalable
              est interdite.
            </p>
          </section>

          <section>
            <h3 className="mb-2 text-base font-semibold text-foreground">
              4. Génération par intelligence artificielle
            </h3>
            <p>
              Les images et vidéos produites par le service sont générées
              automatiquement par des modèles d&apos;intelligence artificielle
              tiers accessibles via kie.ai (Nano Banana Pro / Gemini 3 Pro
              Image pour l&apos;image, Kling 3.0 pour la vidéo) à partir des
              photos et instructions fournies par
              l&apos;utilisateur. Bluminoo Studio ne garantit pas
              l&apos;exactitude, la conformité ou l&apos;absence
              d&apos;erreur des contenus générés.
            </p>
          </section>

          <section>
            <h3 className="mb-2 text-base font-semibold text-foreground">
              5. Contact
            </h3>
            <p>
              Pour toute question relative au site ou à ces mentions
              légales :{" "}
              <a
                href="mailto:mathisvergne27@gmail.com"
                className="text-[var(--link)] underline underline-offset-2 hover:text-primary"
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
