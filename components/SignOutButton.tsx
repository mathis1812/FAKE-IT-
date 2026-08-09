"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/connexion");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="w-full rounded-2xl border border-foreground/10 px-4 py-3 text-sm font-medium text-foreground/85 transition hover:border-foreground/20 hover:text-foreground"
    >
      Se déconnecter
    </button>
  );
}
