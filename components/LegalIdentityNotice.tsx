/**
 * Bandeau d'avertissement affiché en tête des pages légales tant que
 * l'exploitant n'a pas de statut d'entreprise actif (SIRET). À retirer et
 * remplacer les mentions par les données réelles dès la réimmatriculation.
 */
export default function LegalIdentityNotice() {
  return (
    <div className="mb-6 rounded-2xl border border-amber-400/30 bg-amber-400/[0.06] px-4 py-3 text-xs leading-relaxed text-amber-200/90">
      <strong className="font-semibold">Update in progress.</strong> The
      operator&apos;s identification details (legal form, SIRET registration
      number, address) are currently being updated following a
      re-registration. No real payments are being processed until this
      notice has been completed.
    </div>
  );
}
