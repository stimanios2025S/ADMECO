import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasSupabaseConfig } from "./config";

/** Refreshes the auth session on every request + gates /admin behind login. */
export async function updateSession(request: NextRequest) {
  if (!hasSupabaseConfig()) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, any> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        }
      }
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  // The pilotage (`/admin`, `/templates`) is gated here, at the edge:
  // it is a role question, and getting it wrong should never depend on
  // a page remembering to check.
  //
  // The atelier portals are NOT gated here, and that is deliberate.
  // `/portail` and `/portail/<atelier>` must stay public — they ARE the
  // login screen. And `/atelier/...` needs a smarter answer than "not
  // logged in → /login": an anonymous visitor who opens
  // `/atelier/m2/scan` must land on the MOBILIX 2 login, not on a
  // generic page. That decision lives in the page, which knows the
  // atelier from its own slug.
  if (!user && (path.startsWith("/admin") || path.startsWith("/templates"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (user && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/redirection";
    return NextResponse.redirect(url);
  }
  return supabaseResponse;
}
