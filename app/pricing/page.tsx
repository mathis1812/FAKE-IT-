import TemplateHeader from "@/components/TemplateHeader";
import PricingCatalogue from "@/components/PricingCatalogue";

/**
 * Page publique, atteignable déconnecté (footer, sitemap) — même catalogue
 * que RechargeSheet, dans une coquille de page plutôt qu'une feuille. Voir
 * components/PricingCatalogue.tsx pour la structure relevée sur le modèle.
 */
export default function PricingPage() {
  return (
    <>
      <TemplateHeader backHref="/" title="Pricing" />

      <div className="flex min-h-dvh flex-col px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-[calc(env(safe-area-inset-top)+76px)]">
        <PricingCatalogue />
      </div>
    </>
  );
}
