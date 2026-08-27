import { createServiceClient } from "@/lib/supabase/service";
import { IMAGE_GENERATION_COST } from "@/lib/generation-cost";

// Réexporté pour ne pas casser les appelants existants. La valeur elle-même
// vit dans un module sans dépendance serveur, afin que l'interface puisse
// l'afficher avant de lancer une génération.
export { IMAGE_GENERATION_COST };
export const VIDEO_GENERATION_COST = 400;

export async function spendCredits(
  userId: string,
  amount: number,
): Promise<boolean> {
  const service = createServiceClient();
  const { data, error } = await service.rpc("spend_credits", {
    p_user_id: userId,
    p_amount: amount,
  });
  if (error) {
    throw new Error(error.message);
  }
  return data === true;
}

export async function refundCredits(
  userId: string,
  amount: number,
): Promise<void> {
  const service = createServiceClient();
  const { error } = await service.rpc("refund_credits", {
    p_user_id: userId,
    p_amount: amount,
  });
  if (error) {
    console.error(
      `Failed to refund ${amount} credits for user ${userId}:`,
      error.message,
    );
  }
}
