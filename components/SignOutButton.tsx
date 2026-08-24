"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="w-full rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-neutral-300 transition hover:border-white/20 hover:text-white"
    >
      Se déconnecter
    </button>
  );
}
