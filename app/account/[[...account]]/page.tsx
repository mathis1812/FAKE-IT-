import { UserProfile } from "@clerk/nextjs";
import { clerkAppearance } from "@/lib/clerk-appearance";

export default function AccountPage() {
  return (
    <div className="flex flex-col items-center">
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
    </div>
  );
}
