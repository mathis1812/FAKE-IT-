import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isStripeConfigured, stripe } from "@/lib/stripe";

export const runtime = "nodejs";

/**
 * Suppression de compte, immédiate et sans retour — même formulation que
 * l'écran qui l'appelle. `profiles` et `gallery_entries` portent toutes
 * deux `references auth.users(id) on delete cascade` (migrations 0001 et
 * 0004) : supprimer l'utilisateur Auth suffit à effacer ces deux tables,
 * pas besoin de le faire à la main ici.
 *
 * Ce que la cascade ne couvre pas : les fichiers du bucket Storage
 * (`gallery/<userId>/…`) et l'abonnement Stripe, deux systèmes externes que
 * Postgres ne connaît pas. Les deux sont traités explicitement avant de
 * supprimer l'utilisateur — après coup, son identifiant ne permettrait plus
 * de retrouver quoi que ce soit à nettoyer.
 */
export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Sign in to delete your account." },
      { status: 401 },
    );
  }

  const service = createServiceClient();

  if (isStripeConfigured()) {
    const { data: profile } = await service
      .from("profiles")
      .select("stripe_subscription_id")
      .eq("id", user.id)
      .single();

    const subscriptionId = profile?.stripe_subscription_id as
      | string
      | null
      | undefined;

    if (subscriptionId) {
      try {
        await stripe.subscriptions.cancel(subscriptionId);
      } catch (err) {
        // Un abonnement déjà résilié côté Stripe (le client l'a annulé
        // lui-même, ou il a expiré) ne doit pas bloquer la suppression du
        // compte : on logue et on continue plutôt que d'échouer ici.
        console.error(
          `Failed to cancel subscription ${subscriptionId} for user ${user.id}:`,
          err,
        );
      }
    }
  }

  // Tous les buckets rangés par dossier `${user.id}/`. `photo-uploads` porte
  // les photos sources déposées par le client : depuis qu'elles ne transitent
  // plus par l'hébergeur tiers kie.ai (migration 0008), c'est nous qui les
  // détenons, donc c'est à nous de les effacer. Les oublier ici laisserait
  // des photos de personnes identifiables après la suppression du compte.
  for (const bucket of ["gallery", "photo-uploads"]) {
    const { data: files } = await service.storage.from(bucket).list(user.id);
    if (!files || files.length === 0) continue;

    const paths = files.map((file) => `${user.id}/${file.name}`);
    const { error: removeError } = await service.storage
      .from(bucket)
      .remove(paths);
    if (removeError) {
      console.error(
        `Failed to remove ${bucket} files for user ${user.id}:`,
        removeError.message,
      );
    }
  }

  const { error: deleteError } = await service.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error(`Failed to delete user ${user.id}:`, deleteError.message);
    return NextResponse.json(
      {
        error:
          "Unable to delete your account right now. Please try again or contact support.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
