/**
 * Bandeau d'avertissement affiché en tête des pages légales tant que
 * l'exploitant n'a pas de statut d'entreprise actif (SIRET). À retirer et
 * remplacer les mentions par les données réelles dès la réimmatriculation.
 */
export default function LegalIdentityNotice() {
  return (
    <div className="mb-6 rounded-2xl border border-amber-400/30 bg-amber-400/[0.06] px-4 py-3 text-xs leading-relaxed text-amber-200/90">
      <strong className="font-semibold">Mise à jour en cours.</strong> Les
      informations d&apos;identification de l&apos;exploitant (forme
      juridique, numéro SIRET, adresse) sont en cours de mise à jour suite à
      une réimmatriculation. Aucun encaissement réel n&apos;est effectué tant
      que cette mention n&apos;a pas été complétée.
    </div>
  );
}
