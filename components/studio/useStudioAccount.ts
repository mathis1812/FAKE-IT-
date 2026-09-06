"use client";

import { useCallback, useEffect, useState } from "react";
import {
  asPlanId,
  hasRedSnap as planHasRedSnap,
  isVideoOpen,
  TESTING_UNLOCK_ALL_TIERS,
} from "@/lib/generation-tiers";
import { createClient } from "@/lib/supabase/client";

/**
 * Identité et droits du compte connecté, tels que le studio en a besoin.
 *
 * Regroupe ce qui était éparpillé dans `app/page.tsx` : cinq états de compte,
 * la relecture Supabase, et les dérivés de palier qui en découlent. Les garder
 * ensemble évite qu'un appelant lise `planId` brut sans passer par
 * `asPlanId` — un palier inconnu resté en base ouvrirait alors des droits par
 * accident.
 *
 * `refreshCredits` est exposé parce qu'une génération réussie doit rafraîchir
 * le solde affiché sans recharger la page.
 */
export function useStudioAccount() {
  const [credits, setCredits] = useState<number | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [planId, setPlanId] = useState<string | null>(null);
  /** Initiale affichée dans la pastille de compte, tirée de l'e-mail. */
  const [accountInitial, setAccountInitial] = useState("?");
  const [userEmail, setUserEmail] = useState("");

  const refreshCredits = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setIsLoggedIn(!!user);
    if (!user) {
      setCredits(null);
      setAccountInitial("?");
      setUserEmail("");
      return;
    }
    setAccountInitial((user.email?.trim().charAt(0) || "?").toUpperCase());
    setUserEmail(user.email ?? "");
    const { data } = await supabase
      .from("profiles")
      .select("credits, plan")
      .eq("id", user.id)
      .single();
    setCredits(data?.credits ?? 0);
    setPlanId((data?.plan as string | null) ?? null);
  }, []);

  useEffect(() => {
    void refreshCredits();
  }, [refreshCredits]);

  /**
   * Seul un compte connecté ET porteur d'un palier peut générer — sauf
   * pendant la période de test (voir TESTING_UNLOCK_ALL_TIERS dans
   * lib/generation-tiers.ts), où seule la connexion suffit : tant qu'aucun
   * produit Stripe réel n'est configuré, exiger un palier bloquerait tout
   * le monde. TEMPORAIRE, à retirer avec le même flag.
   */
  const isSubscribed = TESTING_UNLOCK_ALL_TIERS
    ? isLoggedIn
    : isLoggedIn && !!planId;
  const plan = asPlanId(planId);
  /**
   * Red Snap réservé aux paliers Pro et Max — voir lib/generation-tiers.ts.
   * Un pack de crédits à l'unité n'y donne pas accès : ce n'est pas un palier.
   */
  const hasRedSnap = planHasRedSnap(plan);
  const videoOpen = isVideoOpen(plan);

  return {
    credits,
    isLoggedIn,
    planId,
    plan,
    accountInitial,
    userEmail,
    isSubscribed,
    hasRedSnap,
    videoOpen,
    refreshCredits,
  };
}
