import Panel from "@/components/Panel";

const FAQ_ITEMS = [
  {
    question: "Quels formats de photo sont acceptés ?",
    answer:
      "JPG, PNG et WebP, jusqu'à 10 Mo. Les images plus lourdes que 2 Mo sont automatiquement compressées avant l'envoi.",
  },
  {
    question: "Combien de temps prend une génération ?",
    answer:
      "Environ 15 à 30 secondes pour une image, et 90 secondes ou plus pour une vidéo.",
  },
  {
    question: "Mes photos sont-elles conservées ?",
    answer:
      "Vos rendus réussis sont sauvegardés uniquement dans ce navigateur (Galerie locale, 15 dernières générations) — rien n'est stocké sur un serveur qui nous appartient.",
  },
  {
    question: "Comment fonctionne l'onglet Vidéo ?",
    answer:
      "Uploadez une image source (et en option une photo de l'objet de remplacement), décrivez le changement souhaité, et Bluminoo Studio génère une courte vidéo intégrant la modification.",
  },
];

export default function AProposPage() {
  return (
    <div className="animate-fade-up mx-auto max-w-3xl py-8">
      <Panel className="mb-6 p-6 sm:p-8">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary">
          À propos
        </p>
        <h2 className="font-display mt-3 text-3xl font-semibold leading-tight tracking-tight text-white">
          Bluminoo Studio
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-neutral-400">
          Bluminoo Studio transforme une photo — visage, poignet ou scène —
          en une version ultra-réaliste avec un élément de luxe intégré
          (montre, voiture, décor haut de gamme), en préservant la
          personne, la pose, la lumière et le cadrage d&apos;origine, en
          image ou en vidéo.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-neutral-400">
          Propulsé par Google Gemini 2.5 Flash Image pour l&apos;image, et
          Kling (via fal.ai) pour la vidéo.
        </p>
      </Panel>

      <Panel className="mb-6 p-6 sm:p-8">
        <h3 className="font-display mb-5 text-2xl font-semibold text-white">
          FAQ
        </h3>
        <div className="space-y-5">
          {FAQ_ITEMS.map((item) => (
            <div key={item.question}>
              <p className="text-sm font-semibold text-neutral-100">
                {item.question}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">
                {item.answer}
              </p>
            </div>
          ))}
        </div>
      </Panel>

      <Panel className="p-6 text-center sm:p-8">
        <h3 className="font-display mb-2 text-xl font-semibold text-white">
          Contact
        </h3>
        <p className="text-sm text-neutral-500">
          Une question, un problème ?{" "}
          <a
            href="mailto:mathisvergne27@gmail.com"
            className="text-primary-soft underline underline-offset-2 hover:text-primary"
          >
            mathisvergne27@gmail.com
          </a>
        </p>
      </Panel>
    </div>
  );
}
