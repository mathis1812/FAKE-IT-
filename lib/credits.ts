import { createServiceClient } from "@/lib/supabase/service";

export {
  IMAGE_GENERATION_COST,
  VIDEO_GENERATION_COST,
} from "@/lib/credit-costs";

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
      `Échec du remboursement de ${amount} crédits pour l'utilisateur ${userId} :`,
      error.message,
    );
  }
}
