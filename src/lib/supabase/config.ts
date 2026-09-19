// ── Configuration Supabase : source unique de vérité ──
// Le mode démo n'est JAMAIS implicite. Sans variables d'environnement
// réelles, l'application échoue avec un message explicite plutôt que
// d'afficher des données fictives qui passeraient pour de la production.

const url = () => (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
const anon = () => (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

/** Les variables d'environnement pointent-elles vers un vrai projet Supabase ? */
export function hasSupabaseConfig(): boolean {
  return Boolean(url() && anon() && !url().includes("xyzcompany"));
}

/** Le jeu de données fictif n'est activable que sur demande explicite. */
export function modeDemoExplicite(): boolean {
  return (process.env.NEXT_PUBLIC_DEMO_MODE ?? "").trim() === "1";
}

/** Le mode démo est-il réellement utilisable ? (non configuré + demandé) */
export function demoActif(): boolean {
  return !hasSupabaseConfig() && modeDemoExplicite();
}

/** Erreur de configuration, formulée pour être actionnable telle quelle. */
export function erreurConfig(): Error {
  return new Error(
    "Supabase n'est pas configuré : renseignez NEXT_PUBLIC_SUPABASE_URL et " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY (.env.local en local, Variables " +
      "d'environnement sur Vercel) puis redéployez. Pour utiliser volontairement " +
      "les données fictives de développement, définissez NEXT_PUBLIC_DEMO_MODE=1."
  );
}
