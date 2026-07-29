"use client";

import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
} from "@clerk/nextjs";
import { clerkAppearance } from "@/lib/clerk-appearance";

function IconAccount() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M3 13.5c1.2-2.2 2.9-3.3 5-3.3s3.8 1.1 5 3.3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconGallery() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect
        x="2"
        y="3"
        width="12"
        height="10"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M2.5 11.5l3.2-3.2a1 1 0 011.4 0L10 11l1.3-1.3a1 1 0 011.4 0l1.3 1.3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconHelp() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M6.4 6.2a1.7 1.7 0 013.2.9c0 1-1.6 1.4-1.6 2.4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="8" cy="11.4" r="0.7" fill="currentColor" />
    </svg>
  );
}

export default function AuthControls() {
  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
      <SignedOut>
        <SignInButton mode="redirect">
          <button
            type="button"
            className="cursor-pointer rounded-full bg-primary px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-ink transition hover:bg-primary-soft sm:px-4"
          >
            Connexion
          </button>
        </SignInButton>
      </SignedOut>
      <SignedIn>
        <UserButton
          appearance={clerkAppearance}
          afterSignOutUrl="/sign-in"
          userProfileMode="navigation"
          userProfileUrl="/account"
        >
          <UserButton.MenuItems>
            <UserButton.Link
              label="Mon compte"
              labelIcon={<IconAccount />}
              href="/account"
            />
            <UserButton.Link
              label="Galerie"
              labelIcon={<IconGallery />}
              href="/galerie"
            />
            <UserButton.Link
              label="Aide"
              labelIcon={<IconHelp />}
              href="/aide"
            />
          </UserButton.MenuItems>
        </UserButton>
      </SignedIn>
    </div>
  );
}
