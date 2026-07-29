import Panel from "@/components/Panel";

const FREE_FEATURES = [
  "Génération photo & vidéo illimitée pour le moment",
  "Presets Montre / Voiture / Lieu",
  "Galerie locale (15 dernières générations)",
];

const PRO_FEATURES = [
  "Génération prioritaire",
  "Résolutions supérieures",
  "Historique étendu",
  "Support prioritaire",
];

export default function TarifsPage() {
  return (
    <div className="animate-fade-up mx-auto max-w-4xl py-8">
      <div className="mb-8 text-center">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary">
          Tarifs
        </p>
        <h2 className="font-display mt-3 text-3xl font-semibold leading-tight tracking-tight text-white">
          Des tarifs simples, pensés pour créer sans limite.
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Panel className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-xl font-semibold text-white">
              Gratuit
            </h3>
            <span className="rounded-full bg-primary/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary-soft">
              Plan actuel
            </span>
          </div>
          <ul className="space-y-2.5 text-sm text-neutral-400">
            {FREE_FEATURES.map((feature) => (
              <li key={feature} className="flex items-start gap-2">
                <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-primary" />
                {feature}
              </li>
            ))}
          </ul>
        </Panel>

        <Panel className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-xl font-semibold text-white">
              Pro
            </h3>
            <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
              Bientôt disponible
            </span>
          </div>
          <ul className="mb-6 space-y-2.5 text-sm text-neutral-400">
            {PRO_FEATURES.map((feature) => (
              <li key={feature} className="flex items-start gap-2">
                <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-neutral-600" />
                {feature}
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled
            className="w-full cursor-not-allowed rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-neutral-500"
          >
            Bientôt disponible
          </button>
        </Panel>
      </div>
    </div>
  );
}
