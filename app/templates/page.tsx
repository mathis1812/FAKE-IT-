"use client";

import { useEffect, useState } from "react";
import StudioTopBar from "@/components/StudioTopBar";
import TemplateShelf from "@/components/TemplateShelf";
import { createClient } from "@/lib/supabase/client";

/**
 * Page des gabarits — écran distinct du studio, comme sur le modèle : même
 * en-tête (menu, compte, crédits) mais titré « Templates » et souligné, puis
 * le catalogue (carte vedette + rangées par catégorie).
 *
 * Elle n'est plus un alias du studio : le studio et les gabarits sont deux
 * pages séparées, avec une transition de navigation (page-in). Le studio a
 * perdu son étagère ; son bouton « Templates » navigue ici.
 *
 * La session (crédits, palier, e-mail) est relue ici pour l'en-tête. C'est
 * un second appel Supabase, léger et isolé, plutôt que de partager l'état du
 * studio à travers les frontières de route.
 */
type Session = {
  credits: number | null;
  planId: string | null;
  email: string;
  initial: string;
};

export default function TemplatesPage() {
  const [session, setSession] = useState<Session>({
    credits: null,
    planId: null,
    email: "",
    initial: "?",
  });

  useEffect(() => {
    const supabase = createClient();
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("credits, plan")
        .eq("id", user.id)
        .single();
      setSession({
        credits: data?.credits ?? 0,
        planId: (data?.plan as string | null) ?? null,
        email: user.email ?? "",
        initial: (user.email?.trim().charAt(0) || "?").toUpperCase(),
      });
    })();
  }, []);

  return (
    <div className="flex flex-col pt-16">
      <StudioTopBar
        credits={session.credits}
        planId={session.planId}
        email={session.email}
        accountInitial={session.initial}
        title="Templates"
      />

      <div className="animate-page-in px-1 pt-2">
        <TemplateShelf />
      </div>
    </div>
  );
}
