import { createServerClient } from "@supabase/ssr";
    import { type NextRequest, NextResponse } from "next/server";

    export async function middleware(request: NextRequest) {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        return NextResponse.next({ request });
      }

      let response = NextResponse.next({ request });

      const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value),
            );
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options),
            );
          },
        },
      });

      // Rafraîchit la session — jose 6.x peut lever une exception sur certains
      // tokens Edge ; on l'attrape pour ne jamais retourner MIDDLEWARE_INVOCATION_FAILED.
      await supabase.auth.getUser();

      return response;
    } catch (err) {
      // Dégradation gracieuse : la requête passe sans rafraîchissement de session.
      // Le Server Component côté page se charge de vérifier l'auth.
      console.error("[middleware] session refresh failed:", err instanceof Error ? err.message : err);
      return NextResponse.next({ request });
    }
    }

    export const config = {
    matcher: [
      "/((?!_next/static|_next/image|favicon.ico|api|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
    // Autorise jose (utilisé par @supabase/auth-js) à utiliser du code dynamique
    // en Edge runtime — nécessaire depuis jose 6.x.
    unstable_allowDynamic: [
      "**/node_modules/jose/**",
      "**/node_modules/@supabase/**",
    ],
    };
    