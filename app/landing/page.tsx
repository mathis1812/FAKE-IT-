"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import HeroSlider from "@/components/HeroSlider";
import TestimonialMarquee from "@/components/TestimonialMarquee";
import { trackLandingCtaClick, trackLandingPageView } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/client";

const FEATURES = [
  {
    title: "Ultra-realistic",
    text: "Lighting, textures, your face, and the original framing all stay intact. The result passes for a real photo.",
  },
  {
    title: "In a real place",
    text: "Add 1 to 3 photos of a spot and put yourself right in it. The setting, mood, and light are analyzed automatically.",
  },
  {
    title: "Photo or video",
    text: "Create a lifestyle image, or bring your scene to life as a short video ready to post to your story.",
  },
];

const FAQ_ITEMS = [
  {
    question: "How does the image generation work?",
    answer:
      "You send your photo, add 1 to 3 photos of the place you want to appear in (or just describe the scene), and the AI blends you in photorealistically while preserving your face, pose, and the original lighting.",
  },
  {
    question: "Do the photos belong to me?",
    answer:
      "Yes. Your renders are saved in your Gallery, tied to your account, and accessible from any device once you're signed in.",
  },
  {
    question: "What is the Red Snap system?",
    answer:
      "A sharing method that sends your photo like a real snap taken on the spot, without the \"Media loaded\" watermark that gives away images imported from the gallery.",
  },
  {
    question: "Can I cancel my subscription?",
    answer:
      "Yes, anytime from your account area, through the secure management portal. Your plan stays active until the end of the period you've already paid for.",
  },
  {
    question: "Are payments secure?",
    answer:
      "Payments are processed by Stripe. No banking data ever passes through or is stored on our servers.",
  },
  {
    question: "Are my generated photos private?",
    answer:
      "Your Gallery is private and tied only to your account. The privacy policy details the subprocessors used to handle photos.",
  },
];

export default function LandingPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    trackLandingPageView();
  }, []);

  // Un visiteur déjà connecté n'a rien à faire sur /sign-up : on le
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

  const ctaHref = isLoggedIn ? "/" : "/sign-up";
  const ctaLabel = isLoggedIn ? "Open the studio" : "Get started now";
  const secondaryCtaLabel = isLoggedIn
    ? "Open the studio"
    : "Start with Bluminoo";

  return (
    <div className="mx-auto max-w-6xl px-4 animate-fade-up">
      {/* HERO — fond noir plein, sans mosaïque derrière : le contraste vient
          du seul bloc média, comme sur le modèle. */}
      <section className="relative flex flex-col items-center gap-5 px-2 pb-16 pt-12 text-center sm:pt-16">
        <h1 className="max-w-[16ch] text-[40px] font-bold leading-[1.06] tracking-[-0.03em] text-white sm:text-[56px]">
          Turn any photo into{" "}
          <span className="bg-gradient-to-r from-[#0285fe] to-[#5ac8fa] bg-clip-text text-transparent">
            an unreal scene
          </span>
          .
        </h1>

        <p className="max-w-[34ch] text-base leading-relaxed text-muted">
          Edit your photos with AI and bring them to life as video. Striking
          results, in seconds.
        </p>

        <Link
          href={ctaHref}
          onClick={() => trackLandingCtaClick("hero_primary")}
          className="mt-3 inline-flex w-full max-w-[440px] items-center justify-center gap-4 rounded-full bg-primary py-4 text-base font-semibold text-white shadow-[0_0_45px_rgba(2,133,254,0.45)] transition hover:bg-primary-soft"
        >
          {ctaLabel}
          <span
            aria-hidden
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/25"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </span>
        </Link>

        <div className="mt-8 flex w-full justify-center">
          <HeroSlider />
        </div>
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
          Exclusive feature
        </p>
        <h2 className="font-display mt-4 text-3xl font-semibold text-white sm:text-4xl">
          Turn your photos into undetectable Red Snaps
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-neutral-300">
          No more &ldquo;Media loaded&rdquo; watermark giving away an imported image.
          Your photo goes out like a real snap taken on the spot.
        </p>
      </section>

      {/* LE PRINCIPE — un lieu de référence, un type de scène produit.
          Les deux photos ne sont pas liées : aucune n'est le résultat de
          l'autre, on illustre juste les deux bouts du principe. */}
      <section className="py-20 sm:py-28">
        <div className="text-center">
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary">
            How it works
          </p>
          <h2 className="font-display mt-3 text-4xl font-semibold text-white sm:text-5xl">
            Your photo, any place you pick
          </h2>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <figure className="overflow-hidden rounded-3xl border border-white/10">
            <img
              src="/landing/restaurant.jpg"
              alt="Photo of a restaurant used as the reference location"
              width={1024}
              height={1024}
              loading="lazy"
              className="h-72 w-full object-cover"
            />
            <figcaption className="border-t border-white/10 bg-white/[0.02] px-5 py-4">
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                The place
              </span>
              <p className="mt-1 text-sm text-neutral-300">
                The photo of the place you provide.
              </p>
            </figcaption>
          </figure>

          <figure className="overflow-hidden rounded-3xl border border-primary/30">
            <img
              src="/landing/rooftop.jpg"
              alt="Example of the kind of scene Bluminoo produces in an outdoor setting"
              width={1024}
              height={1024}
              loading="lazy"
              className="h-72 w-full object-cover"
            />
            <figcaption className="border-t border-primary/20 bg-primary/[0.06] px-5 py-4">
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary-soft">
                The result
              </span>
              <p className="mt-1 text-sm text-neutral-200">
                The kind of scene Bluminoo produces.
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
            The Bluminoo difference
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
            Frequently asked questions
          </h2>
          <p className="mt-3 text-sm text-neutral-400">
            Everything you need to know about Bluminoo Studio.
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
          Ready to impress?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-neutral-300">
          Create your first scene in seconds.
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
