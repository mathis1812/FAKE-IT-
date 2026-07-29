import { UserProfile } from "@clerk/nextjs";
import StudioHeader from "@/components/StudioHeader";
import { clerkAppearance } from "@/lib/clerk-appearance";

export default function AccountPage() {
  return (
    <div className="studio-shell min-h-screen">
      <div
        className="pointer-events-none fixed inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 55% 35% at 50% 0%, rgba(168,85,247,0.16), transparent 55%), #0a0810",
        }}
      />
      <div className="relative z-10">
        <StudioHeader />
        <main className="mx-auto flex max-w-4xl flex-col items-center px-4 py-10 sm:px-6 lg:py-14">
          <div className="mb-8 w-full max-w-xl text-center">
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary">
              Compte
            </p>
            <h1 className="font-display mt-3 text-4xl font-semibold tracking-tight text-white">
              Mon compte
            </h1>
            <p className="mt-3 text-sm text-neutral-400">
              Profil, sécurité et sessions Bluminoo Studio.
            </p>
          </div>
          <UserProfile
            appearance={clerkAppearance}
            routing="path"
            path="/account"
          />
        </main>
      </div>
    </div>
  );
}
