import { createServerSupabase } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/AdminShell";
import SuiviA1Client from "./SuiviA1Client";
import { getProfil } from "@/lib/auth";
import { ETAPES_A1 } from "@/lib/etapes";

export const dynamic = "force-dynamic";

// ═══════════════════════════════════════════════════════════
// SUIVI ATELIER 01 — tout le travail réel de A1
//
// ── Ce que cette page filtrait avant ──
//
//     .filter((o) => /eco/i.test(o.product_line ?? ""))
//     .filter((i) => /ecoo|suivi eco|stock produit fini/i.test(i.design_notes ?? ""))
//
// Ces deux motifs étaient les marqueurs de la DÉMO « gamme ECO ».
// Depuis que les commandes sont créées sur les vrais articles
// Silwane, `product_line` porte le parcours (« ADMEDCO_ASSEMBLE »,
// « ADMEDCO_TOLE », « MOBILIX ») et `design_notes` porte
// « Route … — N étapes… ». Plus rien ne correspondait : la page
// s'affichait vide, ce qui se lit comme « ça m'a renvoyé au tableau
// de bord ». Il n'y avait aucun filtre à garder : l'atelier 1 doit
// voir TOUT son travail, pas seulement les commandes d'une gamme
// disparue.
//
// ── Ce qu'elle lit maintenant ──
//   · les ordres ADMEDCO récents
//   · leurs articles, avec le code et la désignation Silwane
//   · les étapes de CES articles exécutées par l'atelier 1
//
// Un ordre n'apparaît que s'il a réellement des étapes à l'atelier 1 :
// une commande MOBILIX ou une pièce qui démarre à A2 n'a rien à
// faire sur cet écran, et l'y afficher avec zéro étape ferait croire
// à une panne.
// ═══════════════════════════════════════════════════════════

const ATELIER_A1 = 1;

const hint = `Gamme Tôle — ${ETAPES_A1.length} postes : ${ETAPES_A1.map((e) => e.nom).join(" → ")}.`;

export default async function SuiviA1Page() {
  const profil = await getProfil();
  const supabase: any = createServerSupabase();

  let orders: any[] = [];
  let items: any[] = [];
  let steps: any[] = [];

  try {
    const { data: tousOrdres, error } = await supabase
      .from("work_orders")
      .select("id,order_number,status,created_at,due_at,priority,product_line,usine_code")
      .eq("usine_code", "ADMEDCO")
      .order("priority")
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) throw new Error(error.message);

    const ordres = (tousOrdres as any[]) ?? [];
    const orderIds = ordres.map((o) => o.id);

    if (orderIds.length > 0) {
      const { data: tousItems } = await supabase
        .from("work_order_items")
        .select("id,order_id,product_name,quantity,status,design_notes,article_id,steps_completed,steps_total")
        .in("order_id", orderIds)
        .limit(500);
      const bruts = (tousItems as any[]) ?? [];

      // Le code et la désignation viennent du catalogue, pas du texte
      // libre : c'est ce que l'admin a choisi à la création.
      const articleIds = [...new Set(bruts.map((i) => i.article_id).filter(Boolean))];
      const articles = new Map<string, any>();
      if (articleIds.length > 0) {
        const { data: arts } = await supabase
          .from("erp_articles")
          .select("id,code,designation")
          .in("id", articleIds);
        for (const a of (arts as any[]) ?? []) articles.set(a.id, a);
      }
      for (const i of bruts) {
        const a = articles.get(i.article_id);
        i.article_code = a?.code ?? null;
        i.article_designation = a?.designation ?? null;
      }

      const itemIds = bruts.map((i) => i.id);
      if (itemIds.length > 0) {
        const { data: toutesEtapes } = await supabase
          .from("work_order_steps")
          .select(
            "id,item_id,step_order,sequence,step_name,atelier_id,status,quantity_ok,target_qty,estimated_minutes,started_at,completed_at",
          )
          .in("item_id", itemIds)
          .eq("atelier_id", ATELIER_A1)
          .order("sequence")
          .limit(4000);

        steps = (toutesEtapes as any[]) ?? [];
        const avecTravailA1 = new Set(steps.map((s) => s.item_id));
        items = bruts.filter((i) => avecTravailA1.has(i.id));
        const gardes = new Set(items.map((i) => i.order_id));
        orders = ordres.filter((o) => gardes.has(o.id));
      }
    }
  } catch {
    orders = [];
    items = [];
    steps = [];
  }

  return (
    <AdminShell pageTitle="Suivi Atelier 01" pageHint={hint}>
      <SuiviA1Client
        usine={profil?.usine_code ?? "ADMEDCO"}
        orders={orders}
        items={items}
        steps={steps}
      />
    </AdminShell>
  );
}
