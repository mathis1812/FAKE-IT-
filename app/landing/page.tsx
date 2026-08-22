"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import HeroShowcaseMosaic from "@/components/HeroShowcaseMosaic";
import TestimonialMarquee from "@/components/TestimonialMarquee";
import { trackLandingCtaClick, trackLandingPageView } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/client";

const FEATURES = [
  {
    title: "Ultra-réaliste",
    text: "Lumière, textures, visage et cadrage d'origine sont préservés. Le résultat passe pour une vraie photo.",
  },
  {
    title: "Dans un lieu réel",
    text: "Ajoute 1 à 3 photos d'un endroit et retrouve-toi dedans. Le décor, l'ambiance et la lumière sont analysés automatiquement.",
  },
  {
    title: "Photo ou vidéo",
    text: "Crée une image lifestyle, ou donne vie à ta scène en vidéo courte prête à poster en story.",
  },
];

const FAQ_ITEMS = [
  {
    question: "Comment fonctionne la génération d'images ?",
    answer:
      "Tu envoies ta photo, tu ajoutes 1 à 3 photos du lieu où tu veux apparaître (ou tu décris simplement la scène), et l'IA t'intègre dedans de façon photoréaliste en préservant ton visage, ta pose et la lumière d'origine.",
  },
  {
    question: "Les photos m'appartiennent-elles ?",
    answer:
      "Oui. Tes rendus sont sauvegardés dans ta Galerie, associée à ton compte, et accessibles depuis n'importe quel appareil après connexion.",
  },
  {
    question: "Qu'est-ce que le système de Snap Rouge ?",
    answer:
      "Une méthode de partage qui envoie ta photo comme un vrai snap pris sur le moment, sans le filigrane « Média chargé » qui trahit les images importées depuis la galerie.",
  },
  {
    question: "Puis-je annuler mon abonnement ?",
    answer:
      "Oui, à tout moment depuis ton espace compte, via le portail de gestion sécurisé. Ton palier reste actif jusqu'à la fin de la période déjà payée.",
  },
  {
    question: "Les paiements sont-ils sécurisés ?",
    answer:
      "Les paiements sont traités par Stripe. Aucune donnée bancaire ne transite ni n'est stockée sur nos serveurs.",
  },
  {
    question: "Mes photos générées sont-elles confidentielles ?",
    answer:
      "Ta Galerie est privée et rattachée à ton seul compte. La politique de confidentialité détaille les sous-traitants utilisés pour le traitement des photos.",
  },
];

export default function LandingPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    trackLandingPageView();
  }, []);

  // Un visiteur déjà connecté n'a rien à faire sur /inscription : on le
  // renvoie vers le studio plutôt que de lui reproposer de créer un compte.
  useEffect(() => {
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
      return;
    }
    createClient()
      .auth.getSession()
      .then(({ data: { session } }) => {
        setIsLoggedIn(!!session);
      })
      .catch(() => {});
  }, []);

  const ctaHref = isLoggedIn ? "/" : "/inscription";
  const ctaLabel = isLoggedIn ? "Ouvrir le studio" : "Commencer maintenant";
  const secondaryCtaLabel = isLoggedIn
    ? "Ouvrir le studio"
    : "Démarrer avec Bluminoo";

  return (
    <div className="mx-auto max-w-6xl px-4 animate-fade-up">
      {/* HERO — pas de fond opaque : StudioBackdrop (monté dans
          app/layout.tsx) doit rester visible derrière. */}
      <section className="relative flex min-h-[80vh] flex-col items-center justify-center py-20 text-center">
        <HeroShowcaseMosaic />

        <span className="relative rounded-full border border-white/10 bg-black/40 px-5 py-2 text-[11px] font-medium uppercase tracking-[0.18em] text-primary-soft">
          Nouvelle version disponible
        </span>

        <h1 className="font-display relative mt-8 max-w-4xl [text-shadow:0_2px_28px_rgba(0,0,0,0.75)] text-5xl font-semibold leading-[0.95] tracking-[-0.03em] text-white sm:text-7xl md:text-8xl">
          Fake it &apos;til you make it
        </h1>

        <p className="relative mt-6 max-w-2xl text-base leading-relaxed text-neutral-200 [text-shadow:0_1px_18px_rgba(0,0,0,0.8)] sm:text-lg">
          L&apos;IA parfaite pour impressionner ton entourage avec une photo
          en un seul clic.
        </p>

        <Link
          href={ctaHref}
          onClick={() => trackLandingCtaClick("hero_primary")}
          className="relative mt-10 inline-flex items-center justify-center rounded-2xl bg-primary px-8 py-4 text-sm font-semibold text-ink transition hover:bg-primary-soft"
        >
          {ctaLabel}
        </Link>
      </section>

      {/* mx-[calc(50%-50vw)] + w-screen : seul le bandeau doit aller bord à
          bord, indépendamment des paddings cumulés de ce conteneur et de
          <main> (layout) et du plafond max-w-6xl. */}
      <div className="mx-[calc(50%-50vw)] w-screen">
        <TestimonialMarquee />
      </div>

      {/* SOLUTION EXCLUSIVE — le Snap Rouge, mis en avant seul. */}
      <section className="relative overflow-hidden rounded-[2rem] border border-primary/20 bg-primary/10 px-6 py-14 text-center sm:px-12">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary">
          Solution exclusive
        </p>
        <h2 className="font-display mt-4 text-3xl font-semibold text-white sm:text-4xl">
          Envoie tes photos en snap rouge indétectable
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-neutral-300">
          Plus de filigrane « Média chargé » qui trahit une image importée.
          Ta photo part comme un vrai snap pris sur le moment.
        </p>
      </section>

      {/* LE PRINCIPE — un lieu de référence, un type de scène produit.
          Les deux photos ne sont pas liées : aucune n'est le résultat de
          l'autre, on illustre juste les deux bouts du principe. */}
      <section className="py-20 sm:py-28">
        <div className="text-center">
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary">
            Le principe
          </p>
          <h2 className="font-display mt-3 text-4xl font-semibold text-white sm:text-5xl">
            Ta photo, le lieu de ton choix
          </h2>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <figure className="overflow-hidden rounded-3xl border border-white/10">
            <img
              src="/landing/restaurant.jpg"
              alt="Photo d'un restaurant utilisée comme lieu de référence"
              width={1024}
              height={1024}
              loading="lazy"
              className="h-72 w-full object-cover"
            />
            <figcaption className="border-t border-white/10 bg-white/[0.02] px-5 py-4">
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                Le lieu
              </span>
              <p className="mt-1 text-sm text-neutral-300">
                La photo du lieu que tu fournis.
              </p>
            </figcaption>
          </figure>

          <figure className="overflow-hidden rounded-3xl border border-primary/30">
            <img
              src="/landing/rooftop.jpg"
              alt="Exemple du type de scène produit par Bluminoo dans un lieu extérieur"
              width={1024}
              height={1024}
              loading="lazy"
              className="h-72 w-full object-cover"
            />
            <figcaption className="border-t border-primary/20 bg-primary/[0.06] px-5 py-4">
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary-soft">
                Le résultat
              </span>
              <p className="mt-1 text-sm text-neutral-200">
                Le type de scène que Bluminoo produit.
              </p>
            </figcaption>
          </figure>
        </div>

        <div className="mt-8 text-center">
          <Link
            href={ctaHref}
            onClick={() => trackLandingCtaClick("difference_link")}
            className="text-sm font-medium text-primary-soft underline-offset-4 transition hover:text-primary hover:underline"
          >
            {secondaryCtaLabel}
          </Link>
        </div>
      </section>

      {/* LA DIFFÉRENCE BLUMINOO — arguments produit */}
      <section className="pb-20 sm:pb-28">
        <div className="text-center">
          <h2 className="font-display text-4xl font-semibold text-white sm:text-5xl">
            La différence Bluminoo
          </h2>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-3xl border border-white/10 bg-white/[0.02] p-6"
            >
              <h3 className="font-display text-xl font-semibold text-white">
                {feature.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-neutral-400">
                {feature.text}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            href={ctaHref}
            onClick={() => trackLandingCtaClick("difference_cta")}
            className="inline-flex items-center justify-center rounded-2xl border border-primary/40 px-8 py-4 text-sm font-semibold text-primary-soft transition hover:border-primary hover:text-primary"
          >
            {secondaryCtaLabel}
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section className="pb-20 sm:pb-28">
        <div className="text-center">
          <h2 className="font-display text-4xl font-semibold text-white sm:text-5xl">
            Questions fréquentes
          </h2>
          <p className="mt-3 text-sm text-neutral-400">
            Tout ce que tu dois savoir sur Bluminoo Studio.
          </p>
        </div>

        <div className="mx-auto mt-10 max-w-3xl space-y-3">
          {FAQ_ITEMS.map((item) => (
            <details
              key={item.question}
              className="group rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-4"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-white marker:content-none">
                {item.question}
                <span
                  aria-hidden
                  className="shrink-0 text-lg font-normal text-primary-soft transition-transform duration-200 group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-neutral-400">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="relative overflow-hidden rounded-[2rem] border border-primary/20 bg-primary/10 px-6 py-16 text-center sm:px-12 sm:py-24">
        <h2 className="font-display text-4xl font-semibold text-white sm:text-6xl">
          Prêt à impressionner ?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-neutral-300">
          Crée ta première scène en quelques secondes.
        </p>
        <Link
          href={ctaHref}
          onClick={() => trackLandingCtaClick("final_cta")}
          className="mt-10 inline-flex items-center justify-center rounded-2xl bg-primary px-8 py-4 text-sm font-semibold text-ink transition hover:bg-primary-soft"
        >
          {ctaLabel}
        </Link>
      </section>
    </div>
  );
}
