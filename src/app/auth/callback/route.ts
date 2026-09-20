import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = cheminInterne(searchParams.get("next")) ?? "/admin";

  if (code) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll(); },
          setAll(cookiesToSet: { name: string; value: string; options?: Record<string, any> }[]) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            const response = NextResponse.redirect(`${origin}${next}`);
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
            return response;
          }
        }
      }
    );
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${origin}${next}`);
}

/**
 * N'accepte qu'un chemin interne.
 *
 * `?next=` vient de l'URL : sans contrôle, `?next=https://ailleurs.tld`
 * transforme cette route en redirection ouverte — un lien qui porte
 * notre domaine et dépose le visiteur n'importe où. `//ailleurs.tld`
 * est refusé aussi : un navigateur le lit comme une adresse absolue,
 * protocole relatif.
 */
function cheminInterne(valeur: string | null): string | null {
  if (!valeur) return null;
  if (!valeur.startsWith("/") || valeur.startsWith("//")) return null;
  return valeur;
}
