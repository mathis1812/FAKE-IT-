"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Feuille d'authentification remontant du bas de l'écran, par-dessus la
 * page. Elle sert les deux parcours : connexion et création de compte.
 *
 * Le mode est choisi par l'appelant — l'en-tête ouvre la connexion, les
 * appels à l'action de la landing ouvrent l'inscription — puis reste
 * basculable depuis la feuille elle-même, un visiteur pouvant s'être
 * trompé de porte.
 *
 * L'ouverture passe par un événement de fenêtre plutôt que par un contexte
 * React : les déclencheurs vivent dans des arbres différents, un contexte
 * imposerait d'envelopper toute l'application pour un seul état.
 *
 * L'authentification reste par mot de passe, identique à /sign-in et
 * /sign-up, qui demeurent accessibles en direct : les liens existants, le
 * sitemap et les redirections après connexion continuent de fonctionner.
 */

export type AuthMode = "signin" | "signup";

export const AUTH_SHEET_EVENT = "bluminoo:open-auth";

/** À appeler depuis n'importe quel composant client pour ouvrir la feuille. */
export function openAuthSheet(mode: AuthMode = "signin") {
  window.dispatchEvent(new CustomEvent(AUTH_SHEET_EVENT, { detail: mode }));
}

const COPY: Record<
  AuthMode,
  { title: string; subtitle: string; action: string; pending: string; switchTo: string }
> = {
  signin: {
    title: "Sign in",
    subtitle: "Enter your email and password to open your studio.",
    action: "Sign in",
    pending: "Signing in…",
    switchTo: "Create an account",
  },
  signup: {
    title: "Create your account",
    subtitle: "Pick an email and a password, and your studio is ready.",
    action: "Create my account",
    pending: "Creating…",
    switchTo: "I already have an account",
  },
};

export default function AuthSheet() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setIsOpen(false);
    setError(null);
  }, []);

  useEffect(() => {
    const onOpen = (event: Event) => {
      const next = (event as CustomEvent<AuthMode>).detail;
      setMode(next === "signup" ? "signup" : "signin");
      setError(null);
      setIsOpen(true);
    };
    window.addEventListener(AUTH_SHEET_EVENT, onOpen);
    return () => window.removeEventListener(AUTH_SHEET_EVENT, onOpen);
  }, []);

  // Échap ferme, et le défilement de la page est verrouillé tant que la
  // feuille est ouverte — sinon l'arrière-plan défile sous les doigts.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    emailRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, close]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();

      if (mode === "signin") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          setError(
            signInError.status === 400
              ? "Incorrect email or password."
              : "Something went wrong, please try again in a moment.",
          );
          return;
        }
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (signUpError) {
          setError(
            signUpError.message.toLowerCase().includes("password")
              ? "Password must be at least 6 characters long."
              : "Something went wrong, please try again in a moment.",
          );
          return;
        }

        // Confirmation par e-mail désactivée : Supabase ne signale pas une
        // adresse déjà prise par une erreur, mais par un utilisateur au
        // tableau d'identités vide. Sans ce contrôle, un doublon passerait
        // pour une inscription réussie.
        if (data.user?.identities && data.user.identities.length === 0) {
          setError("This email address is already linked to an account.");
          return;
        }
      }

      close();
      router.push("/account");
      router.refresh();
    } catch {
      setError("Something went wrong, please try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  const copy = COPY[mode];

  return (
    <div className="fixed inset-0 z-[100]">
      <button
        type="button"
        aria-label="Close"
        onClick={close}
        className="absolute inset-0 h-full w-full cursor-default bg-black/60 backdrop-blur-md"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-sheet-title"
        className="absolute inset-x-0 bottom-0 flex max-h-[calc(100dvh-env(safe-area-inset-top)-24px)] flex-col overflow-y-auto rounded-t-[47px] bg-black px-6 pb-[calc(env(safe-area-inset-bottom)+28px)] pt-3"
      >
        <span
          aria-hidden
          className="mx-auto h-1 w-9 shrink-0 rounded-full bg-white/25"
        />

        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition active:opacity-70"
        >
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="h-4 w-4"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        <h2
          id="auth-sheet-title"
          className="mt-8 text-[22px] font-semibold leading-tight text-white"
        >
          {copy.title}
        </h2>
        <p className="mt-2 text-[15px] leading-[1.5] text-white/50">
          {copy.subtitle}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
          <input
            ref={emailRef}
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            aria-label="Email"
            className="h-14 w-full rounded-3xl border-[1.5px] border-white/15 bg-black/30 px-4 text-base text-white caret-white outline-none placeholder:text-white/35 focus:border-white/40"
          />
          <input
            type="password"
            required
            // Indique au gestionnaire de mots de passe s'il doit proposer
            // un mot de passe existant ou en générer un nouveau.
            autoComplete={
              mode === "signin" ? "current-password" : "new-password"
            }
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            aria-label="Password"
            className="h-14 w-full rounded-3xl border-[1.5px] border-white/15 bg-black/30 px-4 text-base text-white caret-white outline-none placeholder:text-white/35 focus:border-white/40"
          />

          {error && (
            <p role="alert" className="text-[14px] text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 flex h-14 w-full items-center justify-center rounded-3xl bg-white text-[17px] font-semibold text-black transition active:opacity-90 disabled:opacity-60"
          >
            {loading ? copy.pending : copy.action}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
          }}
          className="mt-3 flex h-14 w-full items-center justify-center rounded-3xl border-[1.5px] border-white/20 bg-transparent text-[17px] font-medium text-white transition active:opacity-90"
        >
          {copy.switchTo}
        </button>

        <p className="mt-5 text-center text-[13px] leading-[1.5] text-white/35">
          By continuing, you agree to our{" "}
          <Link
            href="/terms"
            onClick={close}
            className="underline underline-offset-2"
          >
            Terms
          </Link>{" "}
          and{" "}
          <Link
            href="/privacy"
            onClick={close}
            className="underline underline-offset-2"
          >
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
