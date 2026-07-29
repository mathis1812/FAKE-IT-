"use client";

import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";
import { clerkAppearance } from "@/lib/clerk-appearance";

export default function AuthControls() {
  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <SignedOut>
        <SignInButton mode="redirect">
          <button
            type="button"
            className="cursor-pointer rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-200 transition hover:border-primary/40 hover:text-white sm:px-4"
          >
            Connexion
          </button>
        </SignInButton>
        <SignUpButton mode="redirect">
          <button
            type="button"
            className="cursor-pointer rounded-full bg-primary px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-ink transition hover:bg-primary-soft sm:px-4"
          >
            S&apos;inscrire
          </button>
        </SignUpButton>
      </SignedOut>
      <SignedIn>
        <UserButton appearance={clerkAppearance} afterSignOutUrl="/sign-in" />
      </SignedIn>
    </div>
  );
}
