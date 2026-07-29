import Link from "next/link";

const STEPS = [
  {
    title: "Choisissez le mode",
    body: "Image pour une photo fixe, Vidéo pour animer une scène à partir d’une image source.",
  },
  {
    title: "Importez votre média",
    body: "Glissez-déposez une photo (max 10 Mo). En vidéo, ajoutez aussi l’objet à intégrer si besoin.",
  },
  {
    title: "Sélectionnez un preset",
    body: "Montre, voiture ou lieu — ou décrivez votre intention dans le prompt libre.",
  },
  {
    title: "Générez et comparez",
    body: "Le curseur avant / après révèle le rendu. Téléchargez, puis retrouvez vos créations dans Galerie.",
  },
] as const;

export default function AidePage() {
  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary">
        Aide
      </p>
      <h1 className="font-display mt-3 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
        Comment utiliser Bluminoo
      </h1>
      <p className="mt-4 max-w-xl text-sm leading-relaxed text-neutral-400">
        Transformez une photo en scène de luxe photoréaliste. Connectez-vous
        pour générer ; vos rendus récents restent sur cet appareil dans Galerie.
      </p>

      <ol className="mt-12 space-y-8">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex gap-5">
            <span className="font-display text-2xl font-semibold text-primary/80">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <h2 className="font-display text-xl font-medium text-white">
                {step.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                {step.body}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-14 flex flex-wrap gap-3">
        <Link
          href="/"
          className="rounded-full bg-primary px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-ink transition hover:bg-primary-soft"
        >
          Ouvrir le studio
        </Link>
        <Link
          href="/account"
          className="rounded-full border border-white/10 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-neutral-200 transition hover:border-primary/40 hover:text-white"
        >
          Mon compte
        </Link>
      </div>
    </div>
  );
}
