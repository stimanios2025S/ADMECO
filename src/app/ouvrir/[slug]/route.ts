import { NextResponse, type NextRequest } from "next/server";
import { atelierDuSlug, ficheAtelier, tousLesSlugs, urlAtelier, type SlugAtelier } from "@/lib/portail-atelier";
import { ouvrirAtelier } from "@/lib/ouvrir-atelier";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// ═══════════════════════════════════════════════════════════
// GET /ouvrir/<slug> — OUVRIR L'ATELIER, SANS RIEN TAPER
//
//   /ouvrir/a1   ADMEDCO   Tôle & Gros œuvre
//   /ouvrir/a2   ADMEDCO   Bureau
//   /ouvrir/a3   ADMEDCO   Poudrage & Emballage
//   /ouvrir/m1   MOBILIX   Découpe bois
//   /ouvrir/m2   MOBILIX   Tapissage
//
// ── Pourquoi une route, et pas une page ──
// Poser les cookies de session est une ÉCRITURE. Un composant serveur
// n'a pas le droit d'écrire de cookie — seul un Route Handler ou une
// Server Action le peut. D'où ce GET : il ouvre la session, puis
// redirige vers la file.
//
// ── Pourquoi la session n'est pas écrasée pour un administrateur ──
// Un chef d'atelier ou la direction consulte les cinq files. S'il
// ouvrait A1 en tant qu'équipe A1, il perdrait son propre compte à
// chaque clic — et se retrouverait, sans comprendre, avec les droits
// d'un ouvrier. On le laisse donc tel qu'il est : il a déjà le droit
// d'ouvrir cet atelier.
// ═══════════════════════════════════════════════════════════

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const slug = (params?.slug ?? "").trim().toLowerCase();
  const id = atelierDuSlug(slug);

  if (!id || !ficheAtelier(id) || !tousLesSlugs.includes(slug as SlugAtelier)) {
    return rediriger(req, "/portail");
  }

  const fiche = ficheAtelier(id)!;

  // ── Où revenir ──
  // Un QR de poste mène à /atelier/a1/scan?etape=3 : si l'ouvrier
  // n'a pas encore de session, l'ouverture ne doit pas le déposer sur
  // le tableau au lieu du poste qu'il vient de scanner.
  //
  // `?suite=` n'est PAS une redirection libre : on n'accepte qu'un
  // chemin interne, sous /atelier/, et seulement pour l'atelier qu'on
  // vient d'ouvrir. Sans ces deux contrôles, le paramètre offrirait
  // une redirection ouverte — le visiteur serait envoyé n'importe où
  // depuis un lien qui porte notre domaine.
  const brut = req.nextUrl.searchParams.get("suite") ?? "";
  const suite =
    brut.startsWith(`/atelier/${slug}`) && !brut.startsWith("//") ? brut : null;

  const versAtelier = suite ?? urlAtelier(id);

  // ── Déjà quelqu'un ? ──
  // S'il s'agit d'un administrateur, on ne touche pas à sa session.
  // S'il s'agit déjà de CETTE équipe, on ne refait rien non plus :
  // le clic doit être instantané, pas une re-création de compte.
  const profil = await lireProfil();
  if (profil?.role === "ADMIN") {
    return rediriger(req, versAtelier);
  }
  if (profil?.email && profil.atelier_id === id) {
    return rediriger(req, versAtelier);
  }

  // ── Le compte de l'équipe ──
  const ouverture = await ouvrirAtelier(slug as SlugAtelier);
  if (!ouverture.ok) {
    return rediriger(req, `/portail/${fiche.usine.toLowerCase()}?echec=${ouverture.raison}`);
  }

  // ── La session ──
  // `createServerSupabase` écrit les cookies via `next/headers` : dans
  // un Route Handler, ces écritures partent bien avec la réponse.
  const sb = createServerSupabase();
  const { error } = await sb.auth.signInWithPassword({
    email: ouverture.email,
    password: ouverture.motDePasse,
  });

  if (error) {
    return rediriger(req, `/portail/${fiche.usine.toLowerCase()}?echec=session`);
  }

  return rediriger(req, versAtelier);
}

/**
 * 303 : la méthode devient GET après la redirection, et le navigateur
 * ne rejoue pas l'ouverture en boucle. Un 307 conserverait le GET aussi,
 * mais 303 est le code juste pour « l'action est faite, va voir là-bas ».
 */
function rediriger(req: NextRequest, chemin: string) {
  const url = req.nextUrl.clone();
  url.pathname = chemin.split("?")[0];
  url.search = chemin.includes("?") ? `?${chemin.split("?")[1]}` : "";
  return NextResponse.redirect(url, 303);
}

/** Le profil courant, ou `null` si personne n'est connecté. */
async function lireProfil() {
  const sb: any = createServerSupabase();
  const { data } = await sb.auth.getUser();
  const user = data?.user;
  if (!user) return null;

  const { data: p } = await sb
    .from("profiles")
    .select("role, atelier_id")
    .eq("id", user.id)
    .maybeSingle();

  return {
    role: (p?.role as string | undefined) ?? "WORKER",
    atelier_id: (p?.atelier_id as number | null | undefined) ?? null,
    email: user.email as string | undefined,
  };
}
