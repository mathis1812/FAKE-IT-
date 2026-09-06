"use client";

import { useEffect, useState } from "react";
import StudioTopBar from "@/components/StudioTopBar";
import ResultActions from "@/components/ResultActions";
import ResultViewer from "@/components/ResultViewer";
import TemplateShelf from "@/components/TemplateShelf";
import PromptBar from "@/components/studio/PromptBar";
import StudioCard from "@/components/studio/StudioCard";
import { useRailScreens } from "@/components/studio/useRailScreens";
import { useStudioAccount } from "@/components/studio/useStudioAccount";
import { useStudioGeneration } from "@/components/studio/useStudioGeneration";
import { TEMPLATE_CATEGORIES } from "@/lib/templates";

/**
 * Studio — écran central du produit.
 *
 * Une seule photo en entrée, une description libre, un rendu. Les photos de
 * lieu et le mode vidéo ont été retirés le 27/08 : la description devient
 * donc la seule indication de scène, et le champ n'est plus optionnel.
 *
 * Ce fichier ne fait plus que câbler : le compte, la génération et le rail
 * vivent dans `components/studio/`, la carte et la barre de saisie aussi. Il
 * pesait 1294 lignes et concentrait 97 modifications en 60 jours — c'était le
 * point de collision le plus probable du dépôt (cf. AGENTS.md §2), et le
 * découper était le préalable à l'ouverture de la zone Interface à un second
 * agent.
 */
export default function Home() {
  const account = useStudioAccount();
  const studio = useStudioGeneration({
    isSubscribed: account.isSubscribed,
    plan: account.plan,
    refreshCredits: account.refreshCredits,
  });
  const { screen, setScreen, viewportRef, templatesPanelRef, railProps } =
    useRailScreens();

  // Vue plein ecran du rendu : la vignette le rogne en object-cover.
  const [viewerOpen, setViewerOpen] = useState(false);

  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    const isMobileUserAgent = /Android|iPhone|iPad|iPod/i.test(
      navigator.userAgent,
    );
    setCanShare(isMobileUserAgent && typeof navigator.share === "function");
  }, []);

  const hasTemplates = TEMPLATE_CATEGORIES.length > 0;

  return (
    // overflow-hidden : clippe le rail pour qu'un seul panneau (h-dvh
    // chacun) soit visible à la fois — le second est physiquement présent
    // juste hors champ, pas démonté.
    // `viewportRef` : c'est CET élément qui porte `h-dvh`, donc la hauteur
    // qu'un panneau occupe réellement. On la mesure ici plutôt que de la
    // déduire de `window.innerHeight` — cf. `panelHeight` dans useRailScreens.
    <div ref={viewportRef} className="h-dvh overflow-hidden">
      <StudioTopBar
        credits={account.credits}
        planId={account.planId}
        email={account.userEmail}
        accountInitial={account.accountInitial}
        title={screen === "templates" ? "Templates" : undefined}
        onNavigateStudio={() => setScreen("studio")}
        onNavigateTemplates={() => setScreen("templates")}
        currentScreen={screen}
      />

      {/* Le rail : deux panneaux empilés en flux normal (studio puis
          gabarits), qu'on fait glisser via translateY — 0 pour montrer le
          premier, -100vh pour montrer le second. Glissable au pointeur en
          plus du bouton Templates ; tous les gestionnaires viennent en bloc
          de `useRailScreens`. */}
      <div {...railProps}>
        {/* pt-[calc(...+90px)] : espace exact mesuré sur le modèle entre
            l'en-tête fixe et le contenu de CE panneau — chaque panneau porte
            son propre padding, l'en-tête étant un sibling hors du rail. */}
        {/* div, pas <main> : MainShell fournit déjà le landmark <main> de la
            page (imbriquer deux <main> serait invalide en HTML). */}
        <div className="flex h-dvh flex-col pt-[calc(env(safe-area-inset-top)+90px)]">
          <StudioCard
            prepared={studio.prepared}
            result={studio.result}
            loading={studio.loading}
            paywalled={studio.paywalled}
            isDragging={studio.isDragging}
            setIsDragging={studio.setIsDragging}
            onDrop={studio.onDrop}
            onInputChange={studio.onInputChange}
            inputRef={studio.inputRef}
            onReset={studio.reset}
            onOpenViewer={() => setViewerOpen(true)}
            loadingMessageIndex={studio.loadingMessageIndex}
            elapsedSeconds={studio.elapsedSeconds}
            progressPercent={studio.progressPercent}
          >
            {studio.error && (
              <p
                role="alert"
                className="mt-4 text-center text-[14px] text-red-400"
              >
                {studio.error}
              </p>
            )}

            {viewerOpen && studio.result && (
              <ResultViewer
                resultUrl={studio.result}
                alt="Your generated scene"
                hasRedSnap={account.hasRedSnap}
                canShare={canShare}
                onReset={studio.reset}
                onError={studio.setError}
                onEdited={studio.setResult}
                onClose={() => setViewerOpen(false)}
              />
            )}

            {studio.result && (
              <ResultActions
                resultUrl={studio.result}
                hasRedSnap={account.hasRedSnap}
                canShare={canShare}
                onReset={studio.reset}
                onError={studio.setError}
                onEdited={studio.setResult}
              />
            )}
          </StudioCard>

          <PromptBar
            userNote={studio.userNote}
            setUserNote={studio.setUserNote}
            quality={studio.quality}
            setQuality={studio.setQuality}
            plan={account.plan}
            canSubmit={studio.canSubmit}
            onGenerate={() => void studio.generate()}
            onOpenTemplates={() => setScreen("templates")}
            hasTemplates={hasTemplates}
          />
        </div>

        {/* Panneau des gabarits : sa propre section h-dvh, défilable en
            interne (overflow-y-auto) — le rail ne défile pas, chaque
            panneau porte son propre défilement. */}
        <section
          ref={templatesPanelRef}
          className="no-scrollbar flex h-dvh flex-col overflow-y-auto overscroll-contain pt-[calc(env(safe-area-inset-top)+90px)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <TemplateShelf />
        </section>
      </div>
    </div>
  );
}
