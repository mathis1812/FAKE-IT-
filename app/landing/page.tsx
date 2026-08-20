"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Panel from "@/components/Panel";
import { createClient } from "@/lib/supabase/client";
import { TESTIMONIALS } from "@/lib/testimonials";
import { trackLandingCtaClick, trackLandingPageView } from "@/lib/analytics";

const HERO_IMAGES = [
  "/landing/rooftop.jpg",
  "/landing/jet.jpg",
  "/landing/car.jpg",
  "/landing/restaurant.jpg",
  "/landing/pool.jpg",
  "/landing/concert.jpg",
];

const FEATURES = [
  {
    number: "01",
    title: "Génération ultra-rapide",
    text: "Une idée, une photo, un résultat prêt à poster en quelques secondes.",
  },
  {
    number: "02",
    title: "Qualité photoréaliste",
    text: "Lumière, textures, visage et cadrage sont conservés pour un rendu naturel.",
  },
  {
    number: "03",
    title: "Photo ou vidéo",
    text: "Crée une image lifestyle ou donne vie à ta scène en format vidéo court.",
  },
];

const GALLERY = [
  { src: "/landing/jet.jpg", label: "Voyage privé" },
  { src: "/landing/car.jpg", label: "Nuit en ville" },
  { src: "/landing/pool.jpg", label: "Évasion" },
  { src: "/landing/concert.jpg", label: "Moments forts" },
];

const FAQ_ITEMS = [
  {
    question: "Comment fonctionne Bluminoo Studio ?",
    answer:
      "Ajoute ta photo, choisis un lieu ou un objet, puis laisse Bluminoo créer une scène cohérente avec ta lumière, ta pose et ton cadrage.",
  },
  {
    question: "Les photos sont-elles réalistes ?",
    answer:
      "Bluminoo est conçu pour préserver les détails importants de ta photo tout en intégrant naturellement le nouvel élément.",
  },
  {
    question: "Puis-je créer des vidéos ?",
    answer:
      "Oui. Le studio propose la génération d'images et de courtes vidéos verticales prêtes à partager.",
  },
  {
    question: "Mes photos sont-elles confidentielles ?",
    answer:
      "Tes générations sont associées à ton compte et accessibles dans ta Galerie. Elles ne sont pas affichées publiquement par défaut.",
  },
  {
    question: "Puis-je arrêter mon abonnement ?",
    answer:
      "Oui, tu peux gérer ou annuler ton abonnement depuis ton espace compte.",
  },
];

export default function LandingPage() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
      return;
    }
    createClient()
      .auth.getSession()
      .then(({ data: { session } }) => setIsLoggedIn(!!session));
  }, []);

  useEffect(() => {
    trackLandingPageView();
  }, []);

  const ctaHref = isLoggedIn ? "/" : "/inscription";
  const ctaLabel = isLoggedIn ? "Ouvrir le studio" : "Commencer maintenant";

  return (
    <div className="animate-fade-up mx-auto max-w-7xl py-5 sm:py-8">
      <section className="relative min-h-[650px] overflow-hidden rounded-[2rem] border border-white/10 sm:min-h-[740px]">
        <div className="absolute inset-0 grid grid-cols-2 grid-rows-3 gap-1 opacity-90 sm:grid-cols-3 sm:grid-rows-2">
          {HERO_IMAGES.map((src) => (
            <div key={src} className="relative overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt=""
                aria-hidden
                className="h-full w-full object-cover"
              />
            </div>
          ))}
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(10,8,16,0.16),rgba(10,8,16,0.92)_78%)]" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/30 to-ink/25" />

        <div className="relative z-10 flex min-h-[650px] flex-col items-center justify-center px-5 text-center sm:min-h-[740px]">
          <p className="mb-6 text-[10px] font-semibold uppercase tracking-[0.28em] text-primary-soft">
            La nouvelle génération de contenu lifestyle
          </p>
          <h1 className="font-display max-w-4xl text-5xl font-semibold leading-[0.95] tracking-[-0.03em] text-white sm:text-7xl md:text-8xl">
            Crée la vie
            <br />
            que tu veux montrer.
          </h1>
          <p className="mt-7 max-w-xl text-sm leading-relaxed text-neutral-300 sm:text-base">
            L&apos;IA parfaite pour impressionner ton entourage avec une photo
            ou une vidéo en quelques clics.
          </p>
          <Link
            href={ctaHref}
            onClick={() => trackLandingCtaClick("hero_primary")}
            className="mt-9 rounded-2xl bg-primary px-8 py-4 text-sm font-bold text-ink shadow-[0_0_35px_rgba(168,85,247,0.3)] transition hover:bg-primary-soft"
          >
            {ctaLabel}
          </Link>
          <p className="mt-4 text-[10px] uppercase tracking-[0.16em] text-neutral-500">
            Photo originale → scène ultra-réaliste
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 border-x border-b border-white/10 sm:grid-cols-3">
        {FEATURES.map((feature) => (
          <div
            key={feature.number}
            className="border-b border-white/10 p-6 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 sm:p-8"
          >
            <span className="text-xs font-semibold text-primary">
              {feature.number}
            </span>
            <h2 className="font-display mt-4 text-2xl font-semibold text-white">
              {feature.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-neutral-500">
              {feature.text}
            </p>
          </div>
        ))}
      </section>

      <section className="py-20 sm:py-28">
        <div className="mb-10 flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-primary">
              La différence Bluminoo
            </p>
            <h2 className="font-display mt-3 max-w-xl text-4xl font-semibold leading-tight text-white sm:text-5xl">
              Ton idée. Ton image. Ton nouveau décor.
            </h2>
          </div>
          <Link
            href={ctaHref}
            onClick={() => trackLandingCtaClick("difference_link")}
            className="text-sm font-semibold text-primary-soft underline decoration-primary/40 underline-offset-4 hover:text-white"
          >
            Voir le studio →
          </Link>
        </div>

        <Panel className="grid overflow-hidden p-2 sm:grid-cols-2">
          <div className="relative aspect-[4/5] overflow-hidden rounded-2xl sm:aspect-auto sm:min-h-[520px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/landing/restaurant.jpg"
              alt="Scène lifestyle créée dans un restaurant"
              className="h-full w-full object-cover"
            />
            <span className="absolute left-4 top-4 rounded-full bg-ink/75 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-neutral-300">
              Ta photo
            </span>
          </div>
          <div className="flex flex-col justify-center p-6 sm:p-12">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
              Avant → Après
            </p>
            <h3 className="font-display mt-4 text-3xl font-semibold leading-tight text-white sm:text-4xl">
              Une simple photo peut raconter toute une histoire.
            </h3>
            <p className="mt-5 text-sm leading-relaxed text-neutral-400">
              Choisis ton ambiance, ton lieu ou l&apos;objet qui change tout.
              Bluminoo Studio compose une image cohérente, lumineuse et prête à
              partager.
            </p>
            <ul className="mt-7 space-y-3 text-sm text-neutral-300">
              {[
                "Intégration dans un lieu réel",
                "Objets et décors premium",
                "Format vertical pour tes stories",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  {item}
                </li>
              ))}
            </ul>
            <Link
              href={ctaHref}
              onClick={() => trackLandingCtaClick("difference_cta")}
              className="mt-8 w-fit rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:border-primary/50 hover:text-primary-soft"
            >
              Créer ma scène
            </Link>
          </div>
        </Panel>
      </section>

      <section className="pb-20 sm:pb-28">
        <div className="mb-8 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-primary">
            Inspiration
          </p>
          <h2 className="font-display mt-3 text-4xl font-semibold text-white sm:text-5xl">
            Voir plus grand.
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {GALLERY.map((item) => (
            <div
              key={item.src}
              className="group relative aspect-[3/4] overflow-hidden rounded-2xl border border-white/10"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.src}
                alt={item.label}
                className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-4 pt-12">
                <p className="text-xs font-semibold text-white">{item.label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {TESTIMONIALS.length > 0 && (
        <section className="pb-20 sm:pb-28">
          <div className="mb-8 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-primary">
              Ils en parlent
            </p>
            <h2 className="font-display mt-3 text-4xl font-semibold text-white sm:text-5xl">
              Ce que nos utilisateurs en disent
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {TESTIMONIALS.map((testimonial) => (
              <Panel key={testimonial.name} className="p-6">
                {typeof testimonial.rating === "number" && (
                  <div
                    className="mb-3 flex gap-0.5 text-primary"
                    aria-label={`${testimonial.rating} sur 5`}
                  >
                    {Array.from({ length: 5 }).map((_, i) => (
                      <svg
                        key={i}
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill={i < testimonial.rating! ? "currentColor" : "none"}
                        stroke="currentColor"
                        strokeWidth="1.5"
                        aria-hidden
                      >
                        <path d="M12 2 15 9l7 .6-5.3 4.6L18.2 21 12 17.3 5.8 21l1.5-6.8L2 9.6 9 9z" />
                      </svg>
                    ))}
                  </div>
                )}
                <p className="text-sm leading-relaxed text-neutral-300">
                  &laquo;&nbsp;{testimonial.quote}&nbsp;&raquo;
                </p>
                <p className="mt-4 text-sm font-semibold text-white">
                  {testimonial.name}
                  {testimonial.role && (
                    <span className="ml-1.5 font-normal text-neutral-500">
                      &middot; {testimonial.role}
                    </span>
                  )}
                </p>
              </Panel>
            ))}
          </div>
        </section>
      )}

      <section className="pb-20 sm:pb-28">
        <Panel className="p-6 sm:p-12">
          <div className="mb-8 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-primary">
              Questions fréquentes
            </p>
            <h2 className="font-display mt-3 text-4xl font-semibold text-white">
              Tout ce que tu dois savoir
            </h2>
          </div>
          <div className="mx-auto max-w-3xl divide-y divide-white/10">
            {FAQ_ITEMS.map((item) => (
              <details key={item.question} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-white [&::-webkit-details-marker]:hidden">
                  {item.question}
                  <span className="text-xl font-light text-primary transition group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="max-w-2xl pt-3 text-sm leading-relaxed text-neutral-500">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </Panel>
      </section>

      <section className="relative overflow-hidden rounded-[2rem] border border-primary/20 bg-primary/10 px-6 py-16 text-center sm:px-12 sm:py-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(168,85,247,0.22),transparent_60%)]" />
        <div className="relative">
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-primary-soft">
            À toi de jouer
          </p>
          <h2 className="font-display mt-4 text-4xl font-semibold text-white sm:text-6xl">
            Et si tu le créais maintenant&nbsp;?
          </h2>
          <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-neutral-300">
            Une photo. Une idée. Une scène que personne n&apos;oubliera.
          </p>
          <Link
            href={ctaHref}
            onClick={() => trackLandingCtaClick("final_cta")}
            className="mt-8 inline-block rounded-2xl bg-primary px-8 py-4 text-sm font-bold text-ink transition hover:bg-primary-soft"
          >
            {ctaLabel}
          </Link>
        </div>
      </section>
    </div>
  );
}