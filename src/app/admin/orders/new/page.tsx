import { createServerSupabase } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/AdminShell";
import NewOrderClient, { type ArticleFabrique } from "./NewOrderClient";
import { parcoursProbable } from "@/lib/route-production";

export const dynamic = "force-dynamic";

// ═══════════════════════════════════════════════════════════
// NOUVELLE COMMANDE — le catalogue Silwane, pas la démo
//
// ── Ce que cette page lisait avant ──
// `product_categories` (7 fausses catégories) et
// `process_templates` (68 gabarits de démonstration). L'admin
// choisissait donc sa gamme dans un catalogue inventé, et la
// nomenclature réelle de Silwane n'apparaissait nulle part : c'est
// exactement le symptôme « les noms des produits et la nomenclature
// ne s'ajoutent pas quand on crée la commande ».
//
// ── Ce qu'elle lit maintenant ──
//   erp_articles       le catalogue réel (CHG020, CHG021, SCLG021…)
//   erp_familles       pour nommer la famille, qui décide du parcours
//   erp_nomenclatures  la formule réelle : composant + quantité
//
// Un article est PROPOSÉ à la fabrication s'il est `est_fabrique`
// (IsBOM chez Silwane) OU s'il porte au moins une ligne de
// nomenclature. Le second critère n'est pas redondant : si l'import
// a tourné mais qu'IsBOM n'a pas été coché comme attendu, l'article
// reste visible au lieu de disparaître en silence.
//
// PostgREST plafonne à 1000 lignes par requête : on pagine.
// ═══════════════════════════════════════════════════════════

const PAGE = 1000;

async function lireTout(
  supabase: any,
  table: string,
  select: string,
  ordre?: string,
): Promise<any[]> {
  const out: any[] = [];
  for (let debut = 0; debut < 200_000; debut += PAGE) {
    let q = supabase.from(table).select(select).range(debut, debut + PAGE - 1);
    if (ordre) q = q.order(ordre);
    const { data, error } = await q;
    if (error) throw new Error(`${table} : ${error.message}`);
    const lignes = (data as any[]) ?? [];
    out.push(...lignes);
    if (lignes.length < PAGE) break;
  }
  return out;
}

export default async function NewOrderPage() {
  try {
    const supabase = createServerSupabase();

    const [articles, familles, nomenclatures] = await Promise.all([
      lireTout(
        supabase,
        "erp_articles",
        "id,code,designation,famille_id,unite,prix_vente,est_fabrique,stock_logique",
        "code",
      ),
      lireTout(supabase, "erp_familles", "id,nom", "nom"),
      lireTout(supabase, "erp_nomenclatures", "article_id,composant_id,quantite", "article_id"),
    ]);

    const articleParId = new Map<string, any>(articles.map((a) => [a.id as string, a]));
    const nomFamille = new Map<string, string>(familles.map((f) => [f.id as string, f.nom as string]));

    // Un article qui porte une formule est un article qu'on fabrique,
    // quoi que dise IsBOM.
    const porteUneFormule = new Set<string>(nomenclatures.map((n) => n.article_id as string));

    const composantsDe = new Map<string, ArticleFabrique["composants"]>();
    for (const n of nomenclatures) {
      const c = articleParId.get(n.composant_id as string);
      const qte = Number(n.quantite ?? 0);
      if (!c || !(qte > 0)) continue;
      const liste = composantsDe.get(n.article_id as string) ?? [];
      liste.push({
        id: c.id as string,
        code: (c.code ?? "") as string,
        designation: (c.designation ?? "") as string,
        quantite: qte,
        unite: (c.unite ?? "") as string,
        // MD001…MD004 = main d'œuvre : ce n'est pas de la matière à
        // sortir du stock. On l'affiche, on ne la réserve pas.
        mainOeuvre: /^MD\d+$/i.test(String(c.code ?? "").trim()),
      });
      composantsDe.set(n.article_id as string, liste);
    }

    const fabriques: ArticleFabrique[] = articles
      .filter((a) => a.est_fabrique === true || porteUneFormule.has(a.id as string))
      .map((a) => {
        const id = a.id as string;
        const code = (a.code ?? "") as string;
        const designation = (a.designation ?? "") as string;
        const famille = nomFamille.get(a.famille_id as string) ?? null;
        return {
          id,
          code,
          designation,
          famille,
          unite: (a.unite ?? "") as string,
          prixVente: Number(a.prix_vente ?? 0),
          stockLogique: Number(a.stock_logique ?? 0),
          parcours: parcoursProbable({ code, designation, famille }),
          composants: (composantsDe.get(id) ?? []).sort((x, y) => x.code.localeCompare(y.code)),
        };
      })
      .sort((x, y) => x.code.localeCompare(y.code));

    return (
      <AdminShell
        pageTitle="Nouvelle commande"
        pageHint="Choisissez de vrais articles Silwane : leur gamme et leur nomenclature réelles s'affichent avant validation."
      >
        <NewOrderClient articles={fabriques} />
      </AdminShell>
    );
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    // ── Deux pannes très différentes, deux remèdes opposés ──
    // « infinite recursion » n'a RIEN à voir avec un catalogue vide :
    // c'est la RLS qui s'auto-appelle. Proposer de relancer l'import
    // enverrait l'exploitant chercher au mauvais endroit — c'est
    // exactement ce qui s'est produit.
    const recursion = /infinite recursion|row-level security|permission denied/i.test(msg);

    return (
      <AdminShell pageTitle="Nouvelle commande" pageHint="Choisissez de vrais articles Silwane.">
        <div className="card space-y-3 border-red-200 p-6">
          <p className="font-black text-[#1a1d23]">
            {recursion ? "La sécurité de la base se bloque elle-même" : "Chargement du catalogue impossible"}
          </p>
          <p className="rounded-xl bg-red-50 px-3 py-2 font-mono text-xs text-red-500">{msg}</p>

          {recursion ? (
            <>
              <p className="text-sm text-[#7c8091]">
                Une politique RLS interroge <span className="font-mono">profiles</span> depuis une
                politique posée sur <span className="font-mono">profiles</span> : PostgreSQL refuse de
                planifier la requête. Le catalogue n'est pas en cause — il n'est même pas lu. La
                migration <b>0019</b> répare cela en déplaçant le test « suis-je ADMIN ? » dans une
                fonction <span className="font-mono">SECURITY DEFINER</span>.
              </p>
              <pre className="overflow-x-auto rounded-xl bg-[#1a1d23] px-4 py-3 font-mono text-[11px] leading-relaxed text-[#e8e6e1]">
{`cd /opt/admedco && git pull --ff-only
bash deploy/migrate.sh
pm2 restart admedco:4003`}
              </pre>
            </>
          ) : (
            <>
              <p className="text-sm text-[#7c8091]">
                Cette page lit le catalogue réel : <span className="font-mono">erp_articles</span>,{" "}
                <span className="font-mono">erp_familles</span>,{" "}
                <span className="font-mono">erp_nomenclatures</span>. Si elles sont vides, l'import
                Silwane n'a pas encore tourné :
              </p>
              <pre className="overflow-x-auto rounded-xl bg-[#1a1d23] px-4 py-3 font-mono text-[11px] leading-relaxed text-[#e8e6e1]">
{`cd /opt/admedco
set -a; . ./.env.local; set +a
node scripts/import-silwane.mjs ./Massiexporte`}
              </pre>
            </>
          )}
        </div>
      </AdminShell>
    );
  }
}
