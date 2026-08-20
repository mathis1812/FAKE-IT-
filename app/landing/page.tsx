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

const STATS = [
  { value: "1 à 3 photos", label: "pour intégrer un lieu réel" },
  { value: "~15-30 s", label: "pour générer une image" },
  { value: "4K", label: "qualité jusqu'à ultra-détails" },
  { value: "Image & vidéo", label: "les deux formats, un seul studio" },
];

const EXAMPLES = [
  {
    src: "/landing/rooftop.jpg",
    caption: "Un rooftop, en pleine nuit",
  },
  {
    src: "/landing/restaurant.jpg",
    caption: "Une table dans un restaurant qui en jette",
  },
  {
    src: "/landing/pool.jpg",
    caption: "Une piscine à débordement au coucher du soleil",
  },
];

const DIFFERENTIATORS = [
  {
    title: "Un vrai lieu, pas un décor générique",
    desc: "Ajoute 1 à 3 photos du lieu où tu veux apparaître — Bluminoo analyse la lumière, les matériaux et l'ambiance pour t'y intégrer de façon crédible, sans avoir à écrire de description.",
  },
  {
    title: "Objet de luxe intégré",
    desc: "Montre, voiture, décor : l'objet vient se poser naturellement dans ta photo, en conservant ton visage, ta pose et le cadrage d'origine.",
  },
  {
    title: "Image ou vidéo courte",
    desc: "Génère une image ultra-réaliste en 15 à 30 secondes, ou une vidéo courte avec remplacement d'objet en environ 90 secondes.",
  },
  {
    title: "Prêt à poster",
    desc: "Format vertical adapté aux Stories, téléchargement direct ou partage natif — ta scène est prête pour Instagram, TikTok ou Snapchat.",
  },
];

const FAQ_ITEMS = [
  {
    question: "Comment fonctionne l'intégration dans un lieu réel ?",
    answer:
      "Ajoute 1 à 3 photos du lieu où tu veux apparaître (un restaurant, un rooftop, n'importe quel endroit dont tu as une image). Bluminoo Studio analyse la lumière, les matériaux et l'ambiance du lieu pour t'y intégrer de façon photoréaliste, sans avoir à écrire de description détaillée.",
  },
  {
    question: "Combien de temps prend une génération ?",
    answer:
      "Environ 15 à 30 secondes pour une image, et 90 secondes ou plus pour une vidéo.",
  },
  {
    question: "Mes photos sont-elles conservées ?",
    answer:
      "Tes rendus réussis sont sauvegardés dans ta Galerie, associée à ton compte — accessibles depuis n'importe quel appareil après connexion.",
  },
  {
    question: "Puis-je essayer sans engagement ?",
    answer:
      "Oui : crée ton compte, choisis le plan qui correspond à ton usage, et génère ta première scène en quelques minutes.",
  },
  {
    question: "Les images sont-elles vraiment ultra-réalistes ?",
    answer:
      "Bluminoo Studio préserve ton visage, ta pose, la lumière et le cadrage d'origine tout en intégrant le lieu ou l'objet choisi, pour un rendu aussi crédible que possible.",
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
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
    });
  }, []);

  useEffect(() => {
    trackLandingPageView();
  }, []);

  const ctaHref = isLoggedIn ? "/" : "/inscription";
  const ctaLabel = isLoggedIn ? "Ouvrir le studio" : "Créer ma première photo";

  return (
    <div className="animate-fade-up mx-auto max-w-6xl py-4">
      {/* Hero */}
      <section className="mb-6">
        <div className="relative min-h-[560px] overflow-hidden rounded-3xl border border-white/10 md:min-h-[640px]">
          <div className="absolute inset-0 grid grid-cols-3 grid-rows-2 gap-[2px]">
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
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/85 to-ink/40" />
          <div className="absolute inset-0 bg-gradient-to-r from-ink/60 via-transparent to-ink/60" />

          <div className="relative z-10 flex min-h-[560px] flex-col items-center justify-end px-5 pb-10 text-center md:min-h-[640px] md:justify-center md:pb-0">
            <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-soft">
              Studio photo &amp; vidéo IA
            </span>
            <h1 className="font-display max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight text-white sm:text-5xl md:text-6xl">
              Impressionne ton entourage.
              <br />
              En une photo.
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-relaxed text-neutral-300 sm:text-base">
              Bluminoo Studio te place dans le lieu dont tu rêves ou intègre
              l&apos;objet de luxe qu&apos;il te faut — en photo ou en vidéo,
              ultra-réaliste, prêt à poster en story.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
              <Link
                href={ctaHref}
                onClick={() => trackLandingCtaClick("hero_primary")}
                className="cursor-pointer rounded-2xl bg-primary px-7 py-3.5 text-sm font-bold text-ink transition duration-200 hover:bg-primary-soft"
              >
                {ctaLabel}
              </Link>
              <a
                href="#exemples"
                className="cursor-pointer rounded-2xl border border-white/15 px-7 py-3.5 text-sm font-medium text-neutral-200 transition hover:border-white/30 hover:text-white"
              >
                Voir des exemples
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STATS.map((stat) => (
          <Panel key={stat.label} className="p-4 text-center sm:p-5">
            <p className="font-display text-xl font-semibold text-white sm:text-2xl">
              {stat.value}
            </p>
            <p className="mt-1 text-[11px] leading-snug text-neutral-500">
              {stat.label}
            </p>
          </Panel>
        ))}
      </section>

      {/* Exemples */}
      <section id="exemples" className="mb-10 scroll-mt-24">
        <div className="mb-5 text-center">
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary">
            Exemples
          </p>
          <h2 className="font-display mt-2 text-2xl font-semibold text-white sm:text-3xl">
            Le style de scène que tu peux créer
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-neutral-500">
            Décris ou uploade le lieu — Bluminoo Studio t&apos;y intègre.
            Visuels illustratifs de l&apos;ambiance obtenue.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {EXAMPLES.map((example) => (
            <div
              key={example.src}
              className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-white/10"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={example.src}
                alt={example.caption}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-4 py-3">
                <p className="text-xs font-medium text-neutral-200">
                  {example.caption}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Différenciateurs */}
      <section className="mb-10">
        <div className="mb-5 text-center">
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary">
            Pourquoi Bluminoo
          </p>
          <h2 className="font-display mt-2 text-2xl font-semibold text-white sm:text-3xl">
            Fait pour être cru, pas juste vu
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {DIFFERENTIATORS.map((item) => (
            <Panel key={item.title} className="p-5 sm:p-6">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-primary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"
                    fill="currentColor"
                  />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-white">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-500">
                {item.desc}
              </p>
            </Panel>
          ))}
        </div>
      </section>

      {/* Témoignages (uniquement si de vrais retours clients sont disponibles) */}
      {TESTIMONIALS.length > 0 && (
        <section className="mb-10">
          <div className="mb-5 text-center">
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary">
              Ils en parlent
            </p>
            <h2 className="font-display mt-2 text-2xl font-semibold text-white sm:text-3xl">
              Ce que nos utilisateurs en disent
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {TESTIMONIALS.map((testimonial) => (
              <Panel key={testimonial.name} className="p-5 sm:p-6">
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

      {/* FAQ */}
      <section className="mb-10">
        <Panel className="p-6 sm:p-8">
          <div className="mb-5 text-center">
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary">
              FAQ
            </p>
            <h2 className="font-display mt-2 text-2xl font-semibold text-white sm:text-3xl">
              Questions fréquentes
            </h2>
          </div>
          <div className="mx-auto max-w-2xl space-y-5">
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
      </section>

      {/* CTA final */}
      <section>
        <Panel className="p-8 text-center sm:p-12">
          <h2 className="font-display text-2xl font-semibold text-white sm:text-3xl">
            Prêt à impressionner ton entourage&nbsp;?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-neutral-400">
            Crée ta première scène en quelques minutes — image ou vidéo,
            ultra-réaliste, prête à poster.
          </p>
          <Link
            href={ctaHref}
            onClick={() => trackLandingCtaClick("final_cta")}
            className="mt-6 inline-block cursor-pointer rounded-2xl bg-primary px-8 py-3.5 text-sm font-bold text-ink transition duration-200 hover:bg-primary-soft"
          >
            {ctaLabel}
          </Link>
        </Panel>
      </section>
    </div>
  );
}
