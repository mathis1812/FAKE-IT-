"use client";

import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { clerkAppearance } from "@/lib/clerk-appearance";

export default function AuthControls() {
  return (
    <div className="flex items-center gap-3">
      <SignedOut>
        <SignInButton mode="redirect">
          <button
            type="button"
            className="cursor-pointer rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-200 transition hover:border-primary/40 hover:text-white"
          >
            Connexion
          </button>
        </SignInButton>
      </SignedOut>
      <SignedIn>
        <UserButton
          appearance={clerkAppearance}
          afterSignOutUrl="/sign-in"
        />
      </SignedIn>
    </div>
  );
}
