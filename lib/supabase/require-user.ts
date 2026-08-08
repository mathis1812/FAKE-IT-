import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

type RequireUserResult =
  | { user: User; error?: undefined }
  | { user?: undefined; error: NextResponse };

/**
 * Vérifie la session Supabase pour les routes API.
 * Renvoie 503 si Supabase n'est pas configuré, 401 si pas de session.
 */
export async function requireUser(
  unauthorizedMessage = "Connectez-vous pour continuer.",
): Promise<RequireUserResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      error: NextResponse.json(
        {
          error:
            "Authentification indisponible. Configurez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY.",
        },
        { status: 503 },
      ),
    };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json(
        { error: unauthorizedMessage },
        { status: 401 },
      ),
    };
  }

  return { user };
}
