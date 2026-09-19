"use server";

// ═══════════════════════════════════════════════════════════
// WORKFLOW COMPLET — commande client → triage → matière → production
//
// ── Le chemin d'une commande, tel qu'il est câblé ici ──
//
//   1. creerCommandeClient()      le client (lien à jeton) ou
//                                 l'admin saisit la commande
//   2. trierEtLancerCommande()    l'agent TRIE : une chaise, c'est
//                                 du dur (ADMEDCO) + du mou
//                                 (MOBILIX). Deux sous-commandes,
//                                 jamais mélangées.
//   3. preparerMatiere()          l'agent MATIÈRE éclate la
//                                 nomenclature, applique le
//                                 rendement, RÉSERVE le stock et
//                                 enregistre la dette.
//   4. declarerEtape()            à chaque étape l'ouvrier déclare
//                                 PRIS / RÉUSSI / PERDU.
//   5. parquerEtape()             une urgence arrive : on finit
//                                 l'étape, on parque, on reprend.
//   6. genererJournees()          chaque matin : deux QR par
//      scannerJournee()           ouvrier, « ma journée » et
//                                 entrée/sortie.
//
// ── Ce que ce fichier suppose ──
//
// La migration 0017 doit être jouée. Elle apporte `sequence`
// (l'ordre GLOBAL des étapes), les colonnes de déclaration
// ouvrier, les seuils min/max, la dette de production, les
// rendements, les commandes client et les journées ouvrier.
// Sans elle, chaque écriture échoue avec un message explicite
// (voir `errFr`), jamais en silence.
// ═══════════════════════════════════════════════════════════

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceSupabase } from "@/lib/supabase/service";
import { getProfil, depotMP } from "@/lib/auth";
import { atelierNom, type AtelierId, type UsineCode } from "@/lib/ateliers";
import { chargeParAtelier, routePour, type ParcoursProduit } from "@/lib/route-production";
import {
  appliquerRecuperation,
  planifierMatiere,
  type ArticleInfo,
  type BesoinMatiere,
  type ContexteAgent,
  type LigneNomenclature,
  type RendementMatiere,
  type StockDisponible,
} from "@/lib/agent-matiere";
import { destinationPart, trierCommande } from "@/lib/triage";

// ── Utilitaires ────────────────────────────────────────────

const rnd = (n = 6) => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";
  let s = "";
  for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
};

const num = (v: unknown, defaut = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : defaut;
};

function errFr(prefix: string, e: any): string {
  const m = e?.message ?? String(e);
  if (/relation|column|table|schema|does not exist|migration/i.test(m))
    return `${prefix} : table ou colonne manquante (${m}) — la migration 0017 doit être exécutée sur le serveur.`;
  if (/duplicate key|unique/i.test(m))
    return `${prefix} : doublon détecté (${m}).`;
  return `${prefix} : ${m}`;
}

/** Date du jour au format SQL, dans le fuseau du serveur. */
const jourAujourdhui = (): string => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/**
 * Profil de l'appelant, sans jamais faire échouer l'action.
 *
 * ⚠️ Ne pas confondre « pas de profil » et « pas le droit » : ici
 *    on veut seulement tracer QUI a fait l'action. Les contrôles de
 *    rôle sont faits explicitement, plus bas, là où ils comptent.
 */
async function profilCourant(): Promise<{ id: string | null; role: string }> {
  try {
    const p = await getProfil();
    return { id: p.id || null, role: p.role };
  } catch {
    return { id: null, role: "WORKER" };
  }
}

/** L'atelier demandé détermine l'usine, sans jamais les confondre. */
const usineDeAtelier = (id: number | null | undefined): UsineCode =>
  id === 3 || id === 5 ? "MOBILIX" : "ADMEDCO";

const usineDeParcours = (p: ParcoursProduit): UsineCode =>
  p === "MOBILIX" ? "MOBILIX" : "ADMEDCO";

/** Les ateliers traversés par un parcours, dans l'ordre global. */
const ateliersDuParcours = (p: ParcoursProduit): number[] => {
  const vus: number[] = [];
  for (const e of routePour(p)) if (!vus.includes(e.atelier)) vus.push(e.atelier);
  return vus;
};

// ═══════════════════════════════════════════════════════════
// 1. LE CONTEXTE DE L'AGENT — toutes les données, lues d'un bloc
// ═══════════════════════════════════════════════════════════
// L'agent matière est PUR : il ne touche pas à la base. C'est ici
// qu'on lui apporte ses entrées. Un seul aller-retour par table,
// pas une requête par article — une nomenclature Silwane compte
// des milliers de lignes.
//
// ⚠️ Les stocks sont filtrés par USINE. Une matière ADMEDCO ne
//    doit JAMAIS apparaître comme disponible pour MOBILIX et
//    inversement : c'est la règle « deux usines, deux stocks »
//    posée en 0012.

async function chargerContexteAgent(usineCode: UsineCode): Promise<{
  ctx: ContexteAgent;
  avertissements: string[];
}> {
  const sb: any = createServiceSupabase();
  const avertissements: string[] = [];

  const [arts, nomen, rend, stocks, depots, resa] = await Promise.all([
    sb.from("erp_articles").select("id, code, designation, unite, est_fabrique, est_semi_fini, est_mp"),
    sb.from("erp_nomenclatures").select("article_id, composant_id, quantite"),
    sb.from("rendement_matiere").select("article_id, produit_id, usine_code, unites_produites").eq("usine_code", usineCode).eq("actif", true),
    sb.from("stock_items").select("id, article_id, code, name, depot_code, usine_code, quantity, min_qty, max_qty").eq("usine_code", usineCode),
    sb.from("erp_depots").select("code, type_depot"),
    sb.from("order_item_reservations").select("stock_item_id, estimated_qty, consumed_qty, work_order_items!inner(status)"),
  ]);

  for (const [nom, r] of [
    ["erp_articles", arts],
    ["erp_nomenclatures", nomen],
    ["rendement_matiere", rend],
  ] as const) {
    if (r.error) avertissements.push(`${nom} illisible : ${r.error.message}`);
  }
  if (stocks.error) avertissements.push(`stock_items illisible : ${stocks.error.message}`);
  if (depots.error) avertissements.push(`erp_depots illisible : ${depots.error.message}`);
  if (resa.error) avertissements.push(`réservations illisibles : ${resa.error.message}`);

  // ── Articles ──
  const lignesNomen: LigneNomenclature[] = (nomen.data ?? []).map((l: any) => ({
    articleId: l.article_id,
    composantId: l.composant_id,
    quantite: num(l.quantite, 1),
  }));

  // « Fabriqué » ne se déduit pas d'un seul drapeau : le fichier
  // Silwane renseigne parfois `est_fabrique`, parfois seulement
  // `est_semi_fini`, et parfois rien du tout alors que la
  // nomenclature existe. Le fait d'APPARAÎTRE comme parent dans
  // une formule est la preuve la plus fiable — on la combine aux
  // drapeaux plutôt que de faire confiance à un seul.
  const parents = new Set(lignesNomen.map((l) => l.articleId));

  const articles = new Map<string, ArticleInfo>();
  for (const a of arts.data ?? []) {
    articles.set(a.id, {
      id: a.id,
      code: a.code ?? "",
      designation: a.designation ?? "",
      unite: a.unite ?? "pcs",
      estFabrique: Boolean(a.est_fabrique || a.est_semi_fini || parents.has(a.id)),
    });
  }
  if (lignesNomen.length > 0 && (arts.data ?? []).length === 0)
    avertissements.push("Aucun article chargé alors que la nomenclature n'est pas vide.");

  // ── Rendements ──
  const rendements: RendementMatiere[] = (rend.data ?? []).map((r: any) => ({
    articleId: r.article_id,
    produitId: r.produit_id ?? null,
    usineCode: r.usine_code ?? usineCode,
    unitesProduites: num(r.unites_produites, 1),
  }));

  // ── Réservé déjà posé par d'autres commandes ──
  const reserveParStock = new Map<string, number>();
  for (const r of resa.data ?? []) {
    const statut = (r as any).work_order_items?.status;
    if (statut === "RELEASED" || statut === "CANCELLED") continue;
    const reste = num(r.estimated_qty) - num(r.consumed_qty);
    if (!(reste > 0)) continue;
    reserveParStock.set(r.stock_item_id, (reserveParStock.get(r.stock_item_id) ?? 0) + reste);
  }

  // ── Ordre de prélèvement : la matière première d'abord, le
  //    produit fini en dernier. On ne puise pas dans un stock
  //    aval avant d'avoir vidé l'amont. ──
  const rangDepot = new Map<string, number>();
  const RANG: Record<string, number> = { MP: 0, ATELIER: 1, SOUS_STOCK: 1, EN_COURS: 2, FINAL: 3, PF: 4 };
  for (const d of (depots.data ?? []) as any[]) {
    rangDepot.set(d.code, RANG[d.type_depot as string] ?? 2);
  }

  const listeStocks: StockDisponible[] = (stocks.data ?? [])
    .map((s: any) => ({
      stockItemId: s.id,
      articleId: s.article_id ?? "",
      depotCode: s.depot_code ?? "",
      quantite: num(s.quantity),
      reserve: reserveParStock.get(s.id) ?? 0,
      minQty: s.min_qty === null || s.min_qty === undefined ? null : num(s.min_qty),
      maxQty: s.max_qty === null || s.max_qty === undefined ? null : num(s.max_qty),
    }))
    .sort((a: StockDisponible, b: StockDisponible) => (rangDepot.get(a.depotCode) ?? 2) - (rangDepot.get(b.depotCode) ?? 2));

  const ctx: ContexteAgent = {
    usineCode,
    articles,
    nomenclature: lignesNomen,
    rendements,
    stocks: listeStocks,
  };

  return { ctx, avertissements };
}

// ═══════════════════════════════════════════════════════════
// 2. LA DETTE DE PRODUCTION — lire, créer, absorber
// ═══════════════════════════════════════════════════════════

async function lireDetteOuverte(
  sb: any,
  usineCode: UsineCode,
  articleId: string,
): Promise<Array<{ id: string; qty_due: number }>> {
  const { data, error } = await sb
    .from("dette_production")
    .select("id, qty_due, cree_at")
    .eq("usine_code", usineCode)
    .eq("article_id", articleId)
    .eq("statut", "OUVERTE")
    .order("cree_at", { ascending: true });
  if (error) return [];
  return (data ?? []).map((d: any) => ({ id: d.id, qty_due: num(d.qty_due) }));
}

/**
 * Absorbe la dette ouverte, plus ancienne d'abord.
 *
 * Une commande de 400 qui trouve 50 de dette lance 450 ; les
 * 50 sont retirés des lignes les plus anciennes. Si une ligne
 * n'est absorbée qu'en partie, elle RESTE ouverte avec un
 * solde réduit — on ne solde jamais une dette qu'on n'a pas
 * réellement produite.
 */
async function absorberDette(
  sb: any,
  params: { usineCode: UsineCode; articleId: string; quantite: number; commandeId: string | null },
): Promise<{ absorbe: number; detail: Array<{ id: string; pris: number }> }> {
  let restant = params.quantite;
  const detail: Array<{ id: string; pris: number }> = [];
  if (!(restant > 0)) return { absorbe: 0, detail };

  const lignes = await lireDetteOuverte(sb, params.usineCode, params.articleId);
  for (const l of lignes) {
    if (restant <= 0) break;
    const pris = Math.min(restant, l.qty_due);
    restant -= pris;

    if (pris >= l.qty_due) {
      await sb
        .from("dette_production")
        .update({ statut: "ABSORBEE", absorbe_at: new Date().toISOString(), absorbee_par_id: params.commandeId })
        .eq("id", l.id);
    } else {
      await sb.from("dette_production").update({ qty_due: l.qty_due - pris }).eq("id", l.id);
    }
    detail.push({ id: l.id, pris });
  }

  return { absorbe: params.quantite - restant, detail };
}

// ═══════════════════════════════════════════════════════════
// 3. L'AGENT MATIÈRE — éclater, réserver, endetter
// ═══════════════════════════════════════════════════════════

/**
 * Prépare la matière d'une ligne de commande : éclate la
 * nomenclature du produit, applique les rendements, RÉSERVE le
 * stock disponible (sans jamais le retirer) et enregistre la
 * dette née d'un passage sous le plancher.
 *
 * Appelée au lancement d'une commande, et rejouable : elle
 * remplace les réservations précédentes de la ligne au lieu de
 * les additionner.
 */
export async function preparerMatiere(input: { itemId: string }): Promise<{
  ok: boolean;
  message: string;
  rapport?: {
    produit: string;
    quantite: number;
    besoins: BesoinMatiere[];
    reservations: Array<{ articleId: string; code: string; depotCode: string; quantite: number }>;
    manquants: Array<{ code: string; manque: number; unite: string }>;
    detteCreee: number;
    detteAbsorbee: number;
    quantiteAProduire: number;
    rendementsIncomplets: boolean;
    avertissements: string[];
  };
}> {
  try {
    if (!input.itemId?.trim()) return { ok: false, message: "Ligne de commande introuvable." };

    const sb: any = createServiceSupabase();

    const { data: item, error: eItem } = await sb
      .from("work_order_items")
      .select("id, order_id, article_id, product_name, quantity, status")
      .eq("id", input.itemId)
      .maybeSingle();
    if (eItem) throw new Error(eItem.message);
    if (!item) return { ok: false, message: "Ligne de commande introuvable." };

    if (!item.article_id)
      return {
        ok: false,
        message:
          "Cette ligne n'est reliée à aucun article de la nomenclature : impossible de calculer la matière. Choisissez le produit dans le catalogue.",
      };

    const { data: order } = await sb.from("work_orders").select("id, order_number, usine_code").eq("id", item.order_id).maybeSingle();
    const usine: UsineCode = order?.usine_code === "MOBILIX" ? "MOBILIX" : "ADMEDCO";

    const { ctx, avertissements } = await chargerContexteAgent(usine);

    const produit = ctx.articles.get(item.article_id);
    if (!produit) {
      return {
        ok: false,
        message: `L'article ${item.article_id} est absent de la nomenclature importée : la matière ne peut pas être calculée.`,
      };
    }

    const qteProduit = Math.max(0, num(item.quantity));
    const plan = planifierMatiere(item.article_id, qteProduit, ctx);

    if (plan.besoins.length === 0)
      avertissements.push(
        `Aucune nomenclature pour ${produit.code || produit.designation} : l'article est traité comme une matière d'achat, rien n'est réservé.`,
      );

    // ── Réservations : on remplace celles de cette ligne ──
    // Réserver n'est pas consommer : `consumed_qty` reste à 0 tant
    // que l'ouvrier n'a pas déclaré ce qu'il a réellement pris.
    await sb.from("order_item_reservations").delete().eq("order_item_id", item.id);

    const parArticle = new Map(plan.besoins.map((b) => [b.articleId, b]));
    const lignesResa = plan.reservations
      .filter((r) => r.stockItemId)
      .map((r) => ({
        order_item_id: item.id,
        stock_item_id: r.stockItemId,
        estimated_qty: r.quantite,
        consumed_qty: 0,
        article_id: r.articleId,
        depot_code: r.depotCode,
        rendement_applique: parArticle.get(r.articleId)?.rendementApplique ?? 1,
        statut: "RESERVEE",
      }));

    if (lignesResa.length > 0) {
      const { error: eR } = await sb.from("order_item_reservations").insert(lignesResa);
      if (eR) throw new Error(eR.message);
    }

    // ── Dette et récupération, article par article ──
    // La règle de l'exploitant : le sous-stock ne descend pas sous
    // son plancher. Le manque n'est PAS produit tout de suite — il
    // devient une dette que la commande suivante absorbera.
    let detteCreee = 0;
    let detteAbsorbee = 0;
    let quantiteAProduire = 0;

    const stocksParArticle = new Map<string, StockDisponible[]>();
    for (const s of ctx.stocks) {
      const l = stocksParArticle.get(s.articleId);
      if (l) l.push(s);
      else stocksParArticle.set(s.articleId, [s]);
    }

    for (const b of plan.besoins) {
      if (!(b.quantiteNette > 0)) continue;

      const stocks = stocksParArticle.get(b.articleId) ?? [];
      const ligneDette = await lireDetteOuverte(sb, usine, b.articleId);
      const detteOuverte = ligneDette.reduce((n, d) => n + d.qty_due, 0);

      // Ce qui sera pris sur les stocks de cet article, dans
      // l'ordre de prélèvement déjà appliqué par l'agent.
      const prisParStock = new Map<string, number>();
      for (const r of plan.reservations) {
        if (r.articleId !== b.articleId) continue;
        prisParStock.set(r.stockItemId, (prisParStock.get(r.stockItemId) ?? 0) + r.quantite);
      }

      for (const s of stocks) {
        const pris = prisParStock.get(s.stockItemId) ?? 0;
        if (!(pris > 0)) continue;
        // ⚠️ Le calcul se fait sur le DISPONIBLE, pas sur la
        //    quantité brute : ce qui est déjà réservé par une autre
        //    commande ne compte pas dans le stock réel.
        const dispoReel = Math.max(0, s.quantite - s.reserve);
        const recup = appliquerRecuperation({
          disponible: dispoReel,
          demande: pris,
          minQty: s.minQty,
          detteOuverte: 0, // l'absorption se décide une seule fois par article, plus bas
        });
        if (recup.detteCreee > 0) {
          const { error: eD } = await sb.from("dette_production").insert({
            usine_code: usine,
            atelier_id: null,
            article_id: b.articleId,
            stock_item_id: s.stockItemId,
            depot_code: s.depotCode,
            qty_due: recup.detteCreee,
            commande_origine_id: order?.id ?? null,
            statut: "OUVERTE",
            note: `Passage sous le plancher (${s.minQty}) — reporté sur la commande suivante`,
          });
          if (!eD) detteCreee += recup.detteCreee;
        }
      }

      // La dette ancienne est absorbée par CETTE commande : on
      // produira la quantité demandée PLUS la dette reprise.
      if (detteOuverte > 0) {
        const recup = appliquerRecuperation({
          disponible: b.quantiteNette,
          demande: b.quantiteNette,
          minQty: null,
          detteOuverte,
        });
        if (recup.detteAbsorbee > 0) {
          const { absorbe } = await absorberDette(sb, {
            usineCode: usine,
            articleId: b.articleId,
            quantite: recup.detteAbsorbee,
            commandeId: order?.id ?? null,
          });
          detteAbsorbee += absorbe;
          quantiteAProduire += absorbe;
        }
      }
    }

    // Journal : la trace de ce que l'agent a réservé, et pourquoi.
    try {
      await sb.from("reservation_events").insert(
        plan.reservations.slice(0, 200).map((r) => ({
          order_item_id: item.id,
          stock_item_id: r.stockItemId,
          type: "RESERVE",
          qty: r.quantite,
          note: `Agent matière ${produit.code} ×${qteProduit} → ${r.depotCode}`,
        })),
      );
    } catch {
      /* journal optionnel */
    }

    revalidatePath("/admin/stocks");
    revalidatePath("/admin/orders");

    const rendIncomplets = plan.rendementsIncomplets;
    const message = rendIncomplets
      ? `Matière réservée pour ${produit.designation || produit.code} ×${qteProduit}. ⚠️ Au moins un rendement matière n'est pas renseigné : ces lignes sont calculées 1 pour 1.`
      : `Matière réservée pour ${produit.designation || produit.code} ×${qteProduit} : ${plan.reservations.length} ligne(s) de stock, ${plan.manquants.length} manquant(s).`;

    return {
      ok: true,
      message,
      rapport: {
        produit: produit.code || produit.designation,
        quantite: qteProduit,
        besoins: plan.besoins,
        reservations: plan.reservations.map((r) => ({
          articleId: r.articleId,
          code: ctx.articles.get(r.articleId)?.code ?? "—",
          depotCode: r.depotCode,
          quantite: r.quantite,
        })),
        manquants: plan.manquants.map((m) => ({ code: m.code, manque: m.manque, unite: m.unite })),
        detteCreee,
        detteAbsorbee,
        quantiteAProduire,
        rendementsIncomplets: rendIncomplets,
        avertissements,
      },
    };
  } catch (e: any) {
    return { ok: false, message: errFr("Préparation matière", e) };
  }
}

// ═══════════════════════════════════════════════════════════
// 4. LANCEMENT D'UNE PRODUCTION SUR UNE ROUTE COMPLÈTE
// ═══════════════════════════════════════════════════════════
// C'est ici que `sequence` est écrit : le parcours d'un produit
// traverse plusieurs ateliers, chacun numérotant ses étapes à
// partir de 1. `sequence` est le seul ordre qui tient debout.

async function creerItemEtEtapes(
  sb: any,
  params: {
    orderId: string;
    parcours: ParcoursProduit;
    productName: string;
    quantite: number;
    articleId: string | null;
    roleTriage: string | null;
    destination: string | null;
    tempsEstimes?: Record<string, number>;
    commandeLigneId?: string | null;
  },
): Promise<{ itemId: string; nbEtapes: number; ateliers: number[] }> {
  const route = routePour(params.parcours);
  if (route.length === 0) throw new Error(`Parcours inconnu : ${params.parcours}`);

  const { data: inserted, error: eI } = await sb
    .from("work_order_items")
    .insert({
      order_id: params.orderId,
      product_name: params.productName,
      quantity: Math.max(1, Math.round(params.quantite)),
      status: "CREATED",
      article_id: params.articleId,
      role_triage: params.roleTriage,
      destination: params.destination,
      design_notes: `Route ${params.parcours} — ${route.length} étapes sur ${ateliersDuParcours(params.parcours).length} atelier(s)`,
    })
    .select("id")
    .maybeSingle();
  if (eI) throw new Error(eI.message);
  const itemId = (inserted as any).id as string;

  const etapes = route.map((e) => ({
    item_id: itemId,
    // `step_order` redevient ce qu'il aurait toujours dû être : le
    // numéro d'étape PROPRE À L'ATELIER, celui que l'ouvrier lit.
    step_order: e.ordreAtelier,
    // `sequence` : l'ordre GLOBAL, unique par pièce.
    sequence: e.sequence,
    atelier_id: e.atelier,
    step_name: e.nom,
    estimated_minutes: Math.max(1, Math.round(params.tempsEstimes?.[e.code] ?? 30)),
    has_branch: false,
    status: "PENDING",
    target_qty: Math.max(0, Math.round(params.quantite)),
  }));

  const { error: eS } = await sb.from("work_order_steps").insert(etapes);
  if (eS) throw new Error(eS.message);

  return { itemId, nbEtapes: etapes.length, ateliers: ateliersDuParcours(params.parcours) };
}

/**
 * Lance une production directement, sans passer par une commande
 * client : c'est le bouton « lancer en production » de l'admin.
 *
 * Le produit est décrit par son article (nomenclature réelle) ou,
 * à défaut, par sa désignation. Le parcours décide de la gamme.
 */
export async function lancerProduction(input: {
  orderNumber?: string;
  productName: string;
  quantity: number;
  parcours: ParcoursProduit;
  articleId?: string | null;
  priority?: number;
  atelierDemandeId?: number | null;
  tempsEstimes?: Record<string, number>;
  preparerLaMatiere?: boolean;
  commandeClientId?: string | null;
  commandeLigneId?: string | null;
  roleTriage?: string | null;
}): Promise<{ ok: boolean; message: string; orderId?: string; itemId?: string; nbEtapes?: number }> {
  try {
    const qty = Math.floor(num(input.quantity));
    if (!input.productName?.trim()) return { ok: false, message: "Nom du produit requis." };
    if (!(qty > 0)) return { ok: false, message: "Quantité invalide." };

    const usine = usineDeParcours(input.parcours);
    const numero = input.orderNumber?.trim() || `${usine === "MOBILIX" ? "MBX" : "ADM"}-${new Date().getFullYear()}-${rnd()}`;

    const sb: any = createServiceSupabase();
    const profil = await profilCourant();

    const { data: order, error: eO } = await sb
      .from("work_orders")
      .insert({
        order_number: numero,
        status: "CREATED",
        usine_code: usine,
        product_line: input.parcours,
        priority: Math.min(5, Math.max(1, Math.floor(num(input.priority, 3)))),
        atelier_demande_id: input.atelierDemandeId ?? null,
        commande_client_id: input.commandeClientId ?? null,
        commande_client_ligne_id: input.commandeLigneId ?? null,
        role_triage: input.roleTriage ?? null,
        created_by: profil.id,
      })
      .select("id")
      .maybeSingle();
    if (eO) throw new Error(eO.message);
    const orderId = (order as any).id as string;

    const { itemId, nbEtapes } = await creerItemEtEtapes(sb, {
      orderId,
      parcours: input.parcours,
      productName: `${input.productName.trim()} ×${qty}`,
      quantite: qty,
      articleId: input.articleId ?? null,
      roleTriage: input.roleTriage ?? null,
      destination: usine === "MOBILIX" ? "CLIENT_DIRECT" : "STOCK_PF",
      tempsEstimes: input.tempsEstimes,
      commandeLigneId: input.commandeLigneId ?? null,
    });

    let message = `Production lancée : ${input.productName.trim()} ×${qty} — ${nbEtapes} étapes, usine ${usine}, n° ${numero}.`;

    if (input.preparerLaMatiere !== false && input.articleId) {
      const r = await preparerMatiere({ itemId });
      message += r.ok ? ` Matière : ${r.message}` : ` ⚠️ Matière non préparée — ${r.message}`;
    }

    revalidatePath("/admin/orders");
    revalidatePath("/portal");
    revalidatePath("/admin");
    return { ok: true, message, orderId, itemId, nbEtapes };
  } catch (e: any) {
    return { ok: false, message: errFr("Lancement production", e) };
  }
}

/** Lancement par atelier : l'admin choisit l'atelier, le parcours suit. */
export async function lancerProductionAtelier(input: {
  atelierId: AtelierId;
  productName: string;
  quantity: number;
  articleId?: string | null;
  orderNumber?: string;
  priority?: number;
  tempsEstimes?: Record<string, number>;
}): Promise<{ ok: boolean; message: string }> {
  const parcours: ParcoursProduit =
    input.atelierId === 3 || input.atelierId === 5
      ? "MOBILIX"
      : input.atelierId === 2
        ? "ADMEDCO_ASSEMBLE"
        : "ADMEDCO_TOLE";

  const r = await lancerProduction({
    orderNumber: input.orderNumber,
    productName: input.productName,
    quantity: input.quantity,
    parcours,
    articleId: input.articleId ?? null,
    priority: input.priority,
    atelierDemandeId: input.atelierId,
    tempsEstimes: input.tempsEstimes,
  });
  if (!r.ok) return { ok: false, message: r.message };
  return { ok: true, message: `${r.message} (demandé par ${atelierNom(input.atelierId)})` };
}

// ═══════════════════════════════════════════════════════════
// 5. LA COMMANDE CLIENT
// ═══════════════════════════════════════════════════════════

// ⚠️ Le type de ligne n'est PAS exporté : un fichier « use server »
//    ne doit exposer que des fonctions asynchrones. Les appelants
//    passent un objet littéral, TypeScript contrôle la forme.
type LigneCommandeSaisie = {
  articleId?: string | null;
  designation: string;
  quantite: number;
  prixUnitaire?: number;
  note?: string;
};

/**
 * Crée une commande client — saisie par l'admin pour un client,
 * ou remplie par le client depuis son lien.
 *
 * ⚠️ Aucune donnée de démonstration : le client, les lignes et les
 *    prix viennent tous de l'appelant.
 */
export async function creerCommandeClient(input: {
  clientNom: string;
  clientTelephone?: string;
  clientEmail?: string;
  clientAdresse?: string;
  tiersId?: string | null;
  origine?: "PORTAIL_CLIENT" | "SAISIE_ADMIN";
  note?: string;
  joursValidite?: number;
  lignes: LigneCommandeSaisie[];
}): Promise<{ ok: boolean; message: string; commandeId?: string; numero?: string; token?: string }> {
  try {
    const nom = input.clientNom?.trim();
    if (!nom) return { ok: false, message: "Le nom du client est requis." };

    const lignes = (input.lignes ?? [])
      .map((l) => ({
        articleId: l.articleId ?? null,
        designation: (l.designation ?? "").trim(),
        quantite: num(l.quantite),
        prixUnitaire: num(l.prixUnitaire),
        note: l.note ?? "",
      }))
      .filter((l) => l.quantite > 0 && (l.designation || l.articleId));

    if (lignes.length === 0)
      return { ok: false, message: "Ajoutez au moins une ligne (produit et quantité)." };

    const sb: any = createServiceSupabase();
    const profil = await profilCourant();

    const numero = `CMD-${new Date().getFullYear()}-${rnd()}`;
    const expire = input.joursValidite && input.joursValidite > 0
      ? new Date(Date.now() + input.joursValidite * 86_400_000).toISOString()
      : null;

    const { data: cmd, error: eC } = await sb
      .from("commandes_client")
      .insert({
        numero,
        token_expire_at: expire,
        tiers_id: input.tiersId ?? null,
        client_nom: nom,
        client_telephone: input.clientTelephone ?? "",
        client_email: input.clientEmail ?? "",
        client_adresse: input.clientAdresse ?? "",
        origine: input.origine ?? "SAISIE_ADMIN",
        statut: "RECUE",
        note: input.note ?? "",
        total_estime: lignes.reduce((n, l) => n + l.quantite * l.prixUnitaire, 0),
        created_by: profil.id,
      })
      .select("id, numero, token")
      .maybeSingle();
    if (eC) throw new Error(eC.message);

    const { error: eL } = await sb.from("commande_client_lignes").insert(
      lignes.map((l, i) => ({
        commande_id: cmd.id,
        article_id: l.articleId,
        designation: l.designation || "—",
        quantite: l.quantite,
        prix_unitaire: l.prixUnitaire,
        ligne_ordre: i + 1,
        note: l.note,
      })),
    );
    if (eL) throw new Error(eL.message);

    revalidatePath("/admin/commandes");
    revalidatePath("/commande");
    return {
      ok: true,
      commandeId: cmd.id,
      numero: cmd.numero,
      token: cmd.token,
      message: `Commande ${cmd.numero} enregistrée pour ${nom} — ${lignes.length} ligne(s).`,
    };
  } catch (e: any) {
    return { ok: false, message: errFr("Création de la commande", e) };
  }
}

/**
 * Le client remplit SA commande depuis son lien à jeton.
 *
 * ⚠️ Aucune authentification : c'est le jeton qui fait office de
 *    clé. Il est donc long, aléatoire, et peut expirer
 *    (`token_expire_at`). On ne renvoie jamais autre chose que SA
 *    commande — et on ne laisse pas le portail changer son statut
 *    au-delà de « reçue ».
 */
export async function soumettreCommandePortail(input: {
  token: string;
  clientNom?: string;
  clientTelephone?: string;
  clientEmail?: string;
  clientAdresse?: string;
  note?: string;
  lignes: LigneCommandeSaisie[];
}): Promise<{ ok: boolean; message: string; numero?: string }> {
  try {
    const token = input.token?.trim();
    if (!token) return { ok: false, message: "Lien invalide." };

    const sb: any = createServiceSupabase();
    const { data: cmd, error } = await sb
      .from("commandes_client")
      .select("id, numero, statut, token_expire_at")
      .eq("token", token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!cmd) return { ok: false, message: "Lien invalide ou expiré." };
    if (cmd.token_expire_at && new Date(cmd.token_expire_at).getTime() < Date.now())
      return { ok: false, message: "Ce lien a expiré. Demandez-en un nouveau à ADMEDCO." };
    if (cmd.statut !== "BROUILLON" && cmd.statut !== "RECUE")
      return { ok: false, message: `La commande ${cmd.numero} est déjà en cours de traitement : elle ne peut plus être modifiée en ligne.` };

    const lignes = (input.lignes ?? [])
      .map((l) => ({
        articleId: l.articleId ?? null,
        designation: (l.designation ?? "").trim(),
        quantite: num(l.quantite),
        prixUnitaire: num(l.prixUnitaire),
        note: l.note ?? "",
      }))
      .filter((l) => l.quantite > 0 && (l.designation || l.articleId));

    if (lignes.length === 0) return { ok: false, message: "Ajoutez au moins un produit et sa quantité." };

    // On remplace les lignes : le client a rempli son formulaire
    // d'un trait, on ne veut pas qu'un envoi double les quantités.
    await sb.from("commande_client_lignes").delete().eq("commande_id", cmd.id);

    const { error: eL } = await sb.from("commande_client_lignes").insert(
      lignes.map((l, i) => ({
        commande_id: cmd.id,
        article_id: l.articleId,
        designation: l.designation || "—",
        quantite: l.quantite,
        prix_unitaire: l.prixUnitaire,
        ligne_ordre: i + 1,
        note: l.note,
      })),
    );
    if (eL) throw new Error(eL.message);

    const { error: eC } = await sb
      .from("commandes_client")
      .update({
        client_nom: input.clientNom?.trim() || undefined,
        client_telephone: input.clientTelephone ?? undefined,
        client_email: input.clientEmail ?? undefined,
        client_adresse: input.clientAdresse ?? undefined,
        note: input.note ?? undefined,
        total_estime: lignes.reduce((n, l) => n + l.quantite * l.prixUnitaire, 0),
        statut: "RECUE",
        updated_at: new Date().toISOString(),
      })
      .eq("id", cmd.id);
    if (eC) throw new Error(eC.message);

    revalidatePath("/admin/commandes");
    revalidatePath("/admin");
    return {
      ok: true,
      numero: cmd.numero,
      message: `Commande ${cmd.numero} transmise : ${lignes.length} produit(s). ADMEDCO la triera et la lancera en production.`,
    };
  } catch (e: any) {
    return { ok: false, message: errFr("Envoi de la commande", e) };
  }
}

/** Fait avancer une commande client à la main (livrée, annulée…). */
export async function changerStatutCommande(input: {
  commandeId: string;
  statut: "BROUILLON" | "RECUE" | "TRIEE" | "EN_PRODUCTION" | "PARTIELLE" | "PRETE" | "LIVREE" | "ANNULEE";
}): Promise<{ ok: boolean; message: string }> {
  try {
    const profil = await getProfil();
    if (profil.role !== "ADMIN" && profil.role !== "MAGASINIER")
      return { ok: false, message: "Action réservée à l'administration." };

    const sb: any = createServiceSupabase();
    const { data: cmd, error } = await sb.from("commandes_client").select("id, numero").eq("id", input.commandeId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!cmd) return { ok: false, message: "Commande introuvable." };

    const { error: eU } = await sb
      .from("commandes_client")
      .update({ statut: input.statut, updated_at: new Date().toISOString() })
      .eq("id", cmd.id);
    if (eU) throw new Error(eU.message);

    revalidatePath("/admin/commandes");
    return { ok: true, message: `Commande ${cmd.numero} → ${input.statut}.` };
  } catch (e: any) {
    return { ok: false, message: errFr("Changement de statut", e) };
  }
}

// ═══════════════════════════════════════════════════════════
// 6. LE TRIAGE — une commande, deux usines, jamais mélangées
// ═══════════════════════════════════════════════════════════

/**
 * Trie une commande client et lance les sous-commandes par usine.
 *
 * Le triage lit les composants DIRECTS du produit : le dur part
 * chez ADMEDCO, le mou chez MOBILIX. Deux `work_orders` distincts,
 * deux jeux de documents, reliés par `commande_client_id` — un lien
 * de traçabilité, pas une fusion.
 */
export async function trierEtLancerCommande(input: { commandeId: string; preparerLaMatiere?: boolean }): Promise<{
  ok: boolean;
  message: string;
  sousCommandes?: Array<{ usine: string; numero: string; etapes: number; itemId: string }>;
  nonClassee?: Array<{ code: string; designation: string }>;
}> {
  try {
    if (!input.commandeId?.trim()) return { ok: false, message: "Commande introuvable." };
    const sb: any = createServiceSupabase();

    const { data: cmd, error: eCmd } = await sb
      .from("commandes_client")
      .select("id, numero, client_nom, statut")
      .eq("id", input.commandeId)
      .maybeSingle();
    if (eCmd) throw new Error(eCmd.message);
    if (!cmd) return { ok: false, message: "Commande introuvable." };

    const { data: lignes, error: eL } = await sb
      .from("commande_client_lignes")
      .select("id, article_id, designation, quantite")
      .eq("commande_id", cmd.id)
      .order("ligne_ordre");
    if (eL) throw new Error(eL.message);
    if (!lignes || lignes.length === 0) return { ok: false, message: "Cette commande n'a aucune ligne." };

    // Le triage ne regarde que la nomenclature : il ne lui faut ni
    // rendement ni stock. On lui donne un contexte de nomenclature.
    const { ctx } = await chargerContexteAgent("ADMEDCO");

    const sousCommandes: Array<{ usine: string; numero: string; etapes: number; itemId: string }> = [];
    const nonClassee: Array<{ code: string; designation: string }> = [];

    for (const ligne of lignes) {
      const qte = Math.max(1, Math.round(num(ligne.quantite)));

      if (!ligne.article_id) {
        // Aucun article : on ne peut ni exploser ni trier. On lance
        // la chaîne ADMEDCO complète et on le DIT, plutôt que de
        // perdre la ligne en silence.
        nonClassee.push({ code: "—", designation: `${ligne.designation} (sans article)` });
        const r = await lancerProduction({
          productName: ligne.designation || "Produit sans article",
          quantity: qte,
          parcours: "ADMEDCO_ASSEMBLE",
          articleId: null,
          commandeClientId: cmd.id,
          commandeLigneId: ligne.id,
          preparerLaMatiere: false,
        });
        if (r.ok && r.orderId) {
          sousCommandes.push({ usine: "ADMEDCO", numero: r.orderId, etapes: r.nbEtapes ?? 0, itemId: r.itemId ?? "" });
        }
        continue;
      }

      const triage = trierCommande(ligne.article_id, qte, ctx);
      for (const n of triage.nonClassee) nonClassee.push({ code: n.code, designation: n.designation });

      for (const part of triage.repartitions) {
        const r = await lancerProduction({
          productName: ligne.designation || "Produit",
          quantity: part.quantite,
          parcours: part.parcours,
          articleId: ligne.article_id,
          commandeClientId: cmd.id,
          commandeLigneId: ligne.id,
          roleTriage: part.usineCode === "MOBILIX" ? "MOU" : "DUR",
          preparerLaMatiere: false,
        });
        if (!r.ok) throw new Error(r.message);
        if (r.itemId) {
          sousCommandes.push({ usine: part.usineCode, numero: r.orderId ?? "", etapes: r.nbEtapes ?? 0, itemId: r.itemId });
          if (input.preparerLaMatiere !== false) await preparerMatiere({ itemId: r.itemId });
        }
      }
    }

    await sb.from("commandes_client").update({ statut: "TRIEE", updated_at: new Date().toISOString() }).eq("id", cmd.id);

    revalidatePath("/admin/commandes");
    revalidatePath("/admin/orders");
    revalidatePath("/admin");

    const parUsine = sousCommandes.reduce<Record<string, number>>((acc, s) => {
      acc[s.usine] = (acc[s.usine] ?? 0) + 1;
      return acc;
    }, {});
    const resume = Object.entries(parUsine)
      .map(([u, n]) => `${n} sous-commande(s) ${u}`)
      .join(" + ");

    return {
      ok: true,
      sousCommandes,
      nonClassee,
      message: nonClassee.length
        ? `Commande ${cmd.numero} triée : ${resume}. ⚠️ ${nonClassee.length} composant(s) non classés — à confirmer.`
        : `Commande ${cmd.numero} triée : ${resume}.`,
    };
  } catch (e: any) {
    return { ok: false, message: errFr("Triage de la commande", e) };
  }
}

// ═══════════════════════════════════════════════════════════
// 7. DÉCLARATION OUVRIER — PRIS / RÉUSSI / PERDU
// ═══════════════════════════════════════════════════════════

/**
 * L'ouvrier termine une étape et déclare trois nombres :
 * ce qu'il a PRIS, ce qui a RÉUSSI, ce qui est PERDU.
 *
 * Le déclencheur `update_item_progress` (0017) met à jour
 * l'avancement de la pièce et son atelier courant à partir de
 * `sequence`.
 */
export async function declarerEtape(input: {
  stepId: string;
  quantityTaken: number;
  quantityOk: number;
  quantityRebut?: number;
  motif?: string;
  workerId?: string | null;
  parquer?: boolean;
}): Promise<{ ok: boolean; message: string }> {
  try {
    if (!input.stepId?.trim()) return { ok: false, message: "Étape introuvable." };

    const pris = num(input.quantityTaken);
    const ok = num(input.quantityOk);
    const rebut = num(input.quantityRebut);
    if (pris < 0 || ok < 0 || rebut < 0) return { ok: false, message: "Les quantités ne peuvent pas être négatives." };
    if (ok + rebut > pris + 0.0001)
      return {
        ok: false,
        message: `Incohérence : réussi (${ok}) + perdu (${rebut}) dépasse le pris (${pris}). Corrigez la déclaration.`,
      };

    const sb: any = createServiceSupabase();
    const profil = await profilCourant();
    const workerId = input.workerId ?? profil.id;

    const { data: step, error: eS } = await sb
      .from("work_order_steps")
      .select("id, item_id, atelier_id, step_name, status, started_at, estimated_minutes")
      .eq("id", input.stepId)
      .maybeSingle();
    if (eS) throw new Error(eS.message);
    if (!step) return { ok: false, message: "Étape introuvable." };

    const now = new Date().toISOString();
    const debut = step.started_at ?? now;

    const { error: eU } = await sb
      .from("work_order_steps")
      .update({
        quantity_taken: pris,
        quantity_ok: ok,
        quantity_rebut: rebut,
        status: input.parquer ? "ACTIVE" : "DONE",
        started_at: debut,
        completed_at: input.parquer ? null : now,
        worker_id: workerId,
        actual_minutes: Math.max(0, Math.round((Date.now() - new Date(debut).getTime()) / 60000)),
      })
      .eq("id", step.id);
    if (eU) throw new Error(eU.message);

    // Le temps réel est calculé, pas saisi : on ferme l'affectation
    // ouverte de cet ouvrier sur cette étape. Le déclencheur
    // `calc_duree_affectation` en déduit la durée.
    let affectationFermee = false;
    try {
      const { data: aff } = await sb
        .from("affectations_etape")
        .select("id")
        .eq("step_id", step.id)
        .is("fin_at", null)
        .order("debut_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (aff) {
        affectationFermee = true;
        await sb
          .from("affectations_etape")
          .update({
            fin_at: now,
            quantite_prise: pris,
            quantite_ok: ok,
            quantite_rebut: rebut,
          })
          .eq("id", aff.id);
      }
    } catch {
      /* le suivi du temps est optionnel : il ne bloque pas la production */
    }

    // Parcage : on finit l'étape, on laisse la pièce, on reprendra.
    if (input.parquer) {
      const { error: eP } = await sb.from("parcages").insert({
        step_id: step.id,
        atelier_id: step.atelier_id,
        quantity: ok,
        depot_code: usineDeAtelier(step.atelier_id) === "MOBILIX" ? "DEP-ENCOURS-MBX" : "DEP-ENCOURS-ADM",
        motif: input.motif ?? "Commande urgente prioritaire",
        statut: "PARQUE",
      });
      if (eP) throw new Error(eP.message);
    }

    revalidatePath("/portal");
    revalidatePath("/admin");
    revalidatePath("/admin/orders");

    return {
      ok: true,
      message: `${
        input.parquer
          ? `Étape « ${step.step_name} » parquée : ${ok} pièce(s) en attente de reprise.`
          : `Étape « ${step.step_name} » déclarée : ${pris} pris, ${ok} réussi, ${rebut} perdu.`
      }${affectationFermee ? " Chronomètre arrêté." : ""}`,
    };
  } catch (e: any) {
    return { ok: false, message: errFr("Déclaration d'étape", e) };
  }
}

/** Reprend un travail parqué : l'étape repasse en production. */
export async function reprendreParcage(input: { parcageId: string }): Promise<{ ok: boolean; message: string }> {
  try {
    const sb: any = createServiceSupabase();
    const { data: p, error } = await sb
      .from("parcages")
      .select("id, step_id, quantity, statut")
      .eq("id", input.parcageId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!p) return { ok: false, message: "Parcage introuvable." };
    if (p.statut === "REPRIS") return { ok: false, message: "Ce parcage a déjà été repris." };

    const profil = await profilCourant();

    await sb
      .from("parcages")
      .update({ statut: "REPRIS", repris_at: new Date().toISOString(), repris_par: profil.id })
      .eq("id", p.id);
    await sb.from("work_order_steps").update({ status: "ACTIVE" }).eq("id", p.step_id);

    revalidatePath("/portal");
    revalidatePath("/admin");
    return { ok: true, message: `Travail repris : ${num(p.quantity)} pièce(s) relancée(s).` };
  } catch (e: any) {
    return { ok: false, message: errFr("Reprise du parcage", e) };
  }
}

// ═══════════════════════════════════════════════════════════
// 8. LES QR CODES DE LA JOURNÉE
// ═══════════════════════════════════════════════════════════
// Deux QR par ouvrier, régénérés chaque jour :
//   qr_journee → « ma journée » : la liste de son travail du jour,
//                dans l'ordre fixé par l'admin
//   qr_entree  → contrôle d'entrée et de sortie, scanné à la
//                PREMIÈRE et à la DERNIÈRE opération seulement

/**
 * Génère (ou complète) les journées de travail d'un atelier.
 *
 * Idempotent : relancer la génération le même jour ne crée pas de
 * doublon et ne change PAS les jetons déjà imprimés — un ouvrier
 * qui a scanné son QR du matin doit pouvoir le rescanner le soir.
 */
export async function genererJournees(input: { jour?: string; atelierId?: number | null }): Promise<{
  ok: boolean;
  message: string;
  journees?: Array<{ workerId: string; nom: string; atelierId: number | null; qrJournee: string; qrEntree: string }>;
}> {
  try {
    const jour = input.jour?.trim() || jourAujourdhui();
    const sb: any = createServiceSupabase();
    const profil = await profilCourant();

    let q: any = sb.from("profiles").select("id, full_name, atelier_id, usine_code").eq("role", "WORKER");
    if (input.atelierId) q = q.eq("atelier_id", input.atelierId);

    const { data: workers, error: eW } = await q;
    if (eW) throw new Error(eW.message);
    if (!workers || workers.length === 0)
      return { ok: false, message: "Aucun ouvrier à qui générer une journée. Ajoutez les ouvriers (rôle WORKER) avec leur atelier." };

    const { data: existantes, error: eE } = await sb
      .from("journees_ouvrier")
      .select("id, worker_id, atelier_id, qr_journee, qr_entree")
      .eq("jour", jour);
    if (eE) throw new Error(eE.message);

    const parWorker = new Map((existantes ?? []).map((j: any) => [j.worker_id, j]));
    const aCreer = workers.filter((w: any) => !parWorker.has(w.id));

    if (aCreer.length > 0) {
      const { error: eI } = await sb.from("journees_ouvrier").insert(
        aCreer.map((w: any) => ({
          jour,
          worker_id: w.id,
          atelier_id: w.atelier_id ?? input.atelierId ?? null,
          genere_par: profil.id,
        })),
      );
      if (eI) throw new Error(eI.message);
    }

    const { data: toutes, error: eT } = await sb
      .from("journees_ouvrier")
      .select("worker_id, atelier_id, qr_journee, qr_entree")
      .eq("jour", jour);
    if (eT) throw new Error(eT.message);

    const nomParWorker = new Map(workers.map((w: any) => [w.id, w.full_name ?? "Ouvrier"]));
    const journees = (toutes ?? [])
      .filter((j: any) => nomParWorker.has(j.worker_id))
      .map((j: any) => ({
        workerId: j.worker_id,
        nom: nomParWorker.get(j.worker_id) as string,
        atelierId: j.atelier_id ?? null,
        qrJournee: j.qr_journee,
        qrEntree: j.qr_entree,
      }));

    revalidatePath("/admin/ouvriers");
    return {
      ok: true,
      journees,
      message: `Journées du ${jour} : ${journees.length} ouvrier(s) — ${aCreer.length} nouvelle(s) génération(s), les jetons existants sont conservés.`,
    };
  } catch (e: any) {
    return { ok: false, message: errFr("Génération des journées", e) };
  }
}

/**
 * État de la journée d'un ouvrier — LECTURE SEULE.
 *
 * ⚠️ Volontairement séparée de `pointerJournee` : cette fonction
 *    est appelée au RENDU de la page, et `revalidatePath` y est
 *    interdit. Une lecture ne doit de toute façon rien écrire —
 *    recharger la page ne doit pas pointer une arrivée.
 *
 * Le type de jeton décide de ce qu'on renvoie :
 *   qr_entree  → l'ouvrier, ses heures, et le bouton à afficher
 *   qr_journee → la journée entière, dans l'ordre fixé par l'admin
 */
export async function etatJournee(input: { token: string }): Promise<{
  ok: boolean;
  message: string;
  type?: "ENTREE" | "JOURNEE";
  jour?: string;
  ouvrier?: { id: string; nom: string };
  atelier?: string;
  arrivee?: string | null;
  depart?: string | null;
  prochainPointage?: "ARRIVEE" | "DEPART" | null;
  etapes?: Array<{
    affectationId: string | null;
    stepId: string;
    ordreDuJour: number | null;
    atelierId: number | null;
    atelierNom: string;
    nom: string;
    commande: string;
    produit: string;
    quantite: number;
    statut: string;
    estPremiere: boolean;
    estDerniere: boolean;
    minutesEstimees: number;
  }>;
}> {
  try {
    const token = input.token?.trim();
    if (!token) return { ok: false, message: "Code QR illisible." };

    const sb: any = createServiceSupabase();
    const { data: j, error } = await sb
      .from("journees_ouvrier")
      .select("id, jour, worker_id, atelier_id, qr_journee, qr_entree, arrivee_at, depart_at")
      .or(`qr_journee.eq.${token},qr_entree.eq.${token}`)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!j)
      return {
        ok: false,
        message: "Ce code QR n'est pas valide aujourd'hui. Demandez-en un nouveau à l'administrateur.",
      };

    const { data: w } = await sb.from("profiles").select("id, full_name, atelier_id").eq("id", j.worker_id).maybeSingle();
    const ouvrier = { id: j.worker_id, nom: (w as any)?.full_name ?? "Ouvrier" };
    const atelierId = j.atelier_id ?? (w as any)?.atelier_id ?? null;

    if (j.qr_entree === token) {
      return {
        ok: true,
        type: "ENTREE",
        jour: j.jour,
        ouvrier,
        atelier: atelierId ? atelierNom(atelierId) : undefined,
        arrivee: j.arrivee_at ?? null,
        depart: j.depart_at ?? null,
        prochainPointage: !j.arrivee_at ? "ARRIVEE" : !j.depart_at ? "DEPART" : null,
        message: !j.arrivee_at
          ? `${ouvrier.nom} — vous n'avez pas encore pointé votre entrée.`
          : !j.depart_at
            ? `${ouvrier.nom} — entrée pointée, sortie en attente.`
            : `${ouvrier.nom} — entrée et sortie pointées.`,
      };
    }

    const { data: aff, error: eA } = await sb
      .from("affectations_etape")
      .select("id, step_id, atelier_id, ordre_du_jour, debut_at, fin_at")
      .eq("journee_id", j.id)
      .order("ordre_du_jour", { ascending: true, nullsFirst: false });
    if (eA) throw new Error(eA.message);

    const stepIds = (aff ?? []).map((a: any) => a.step_id);
    let steps: any[] = [];
    if (stepIds.length > 0) {
      const { data: s } = await sb
        .from("work_order_steps")
        .select("id, item_id, step_order, sequence, atelier_id, step_name, status, estimated_minutes, quantity_taken, quantity_ok, quantity_rebut, work_order_items!inner(product_name, quantity, order_id, work_orders!inner(order_number))")
        .in("id", stepIds);
      steps = (s ?? []).sort((a: any, b: any) => num(a.sequence) - num(b.sequence));
    }

    const parStep = new Map(steps.map((s: any) => [s.id, s]));
    const etapes = (aff ?? []).map((a: any) => {
      const s: any = parStep.get(a.step_id) ?? {};
      const it: any = s.work_order_items ?? {};
      const wo: any = it.work_orders ?? {};
      return {
        affectationId: a.id,
        stepId: a.step_id,
        ordreDuJour: a.ordre_du_jour ?? null,
        atelierId: s.atelier_id ?? a.atelier_id ?? null,
        atelierNom: atelierNom(s.atelier_id ?? a.atelier_id),
        nom: s.step_name ?? "Étape",
        commande: wo.order_number ?? "—",
        produit: it.product_name ?? "—",
        quantite: num(it.quantity),
        statut: s.status ?? "PENDING",
        estPremiere: false,
        estDerniere: false,
        minutesEstimees: num(s.estimated_minutes, 30),
      };
    });

    // La première et la dernière opération : ce sont elles, et elles
    // seules, que le QR d'entrée/sortie encadre.
    if (etapes.length > 0) {
      etapes[0].estPremiere = true;
      etapes[etapes.length - 1].estDerniere = true;
    }

    return {
      ok: true,
      type: "JOURNEE",
      jour: j.jour,
      ouvrier,
      atelier: atelierId ? atelierNom(atelierId) : undefined,
      arrivee: j.arrivee_at ?? null,
      depart: j.depart_at ?? null,
      etapes,
      message:
        etapes.length === 0
          ? `${ouvrier.nom} : aucune opération ne vous est encore affectée aujourd'hui.`
          : `${ouvrier.nom} — ${etapes.length} opération(s) aujourd'hui, de « ${etapes[0].nom} » à « ${etapes[etapes.length - 1].nom} ».`,
    };
  } catch (e: any) {
    return { ok: false, message: errFr("Lecture du code QR", e) };
  }
}

/**
 * Pointe l'entrée ou la sortie de l'ouvrier.
 *
 * Un seul geste : s'il n'a pas d'heure d'arrivée, ce scan EST son
 * arrivée ; sinon c'est son départ. On ne demande jamais à
 * l'ouvrier de choisir — il se tromperait, et le geste doit rester
 * un geste de badge.
 *
 * ⚠️ Refuse un jeton de journée : l'entrée/sortie se pointe au
 *    poste, pas depuis la liste de travail.
 */
export async function pointerJournee(input: { token: string }): Promise<{
  ok: boolean;
  message: string;
  evenement?: "ARRIVEE" | "DEPART";
  ouvrier?: { id: string; nom: string };
}> {
  try {
    const token = input.token?.trim();
    if (!token) return { ok: false, message: "Code QR illisible." };

    const sb: any = createServiceSupabase();
    const { data: j, error } = await sb
      .from("journees_ouvrier")
      .select("id, jour, worker_id, qr_journee, qr_entree, arrivee_at, depart_at")
      .eq("qr_entree", token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!j)
      return {
        ok: false,
        message: "Ce code n'est pas un code d'entrée/sortie valide. Utilisez le QR « entrée / sortie ».",
      };

    const { data: w } = await sb.from("profiles").select("id, full_name").eq("id", j.worker_id).maybeSingle();
    const ouvrier = { id: j.worker_id, nom: (w as any)?.full_name ?? "Ouvrier" };
    const now = new Date().toISOString();

    // Déjà pointé deux fois : on rafraîchit l'heure de sortie plutôt
    // que de refuser — un ouvrier qui rescanne en partant vraiment
    // ne doit pas rester bloqué sur une heure fausse.
    if (!j.arrivee_at) {
      const { error: eU } = await sb.from("journees_ouvrier").update({ arrivee_at: now }).eq("id", j.id);
      if (eU) throw new Error(eU.message);
      revalidatePath("/admin/ouvriers");
      return { ok: true, evenement: "ARRIVEE", ouvrier, message: `Bienvenue ${ouvrier.nom} — entrée enregistrée à ${now.slice(11, 16)}.` };
    }

    const { error: eU } = await sb.from("journees_ouvrier").update({ depart_at: now }).eq("id", j.id);
    if (eU) throw new Error(eU.message);
    revalidatePath("/admin/ouvriers");
    return { ok: true, evenement: "DEPART", ouvrier, message: `Au revoir ${ouvrier.nom} — sortie enregistrée à ${now.slice(11, 16)}.` };
  } catch (e: any) {
    return { ok: false, message: errFr("Pointage", e) };
  }
}

/**
 * Affecte une étape à un ouvrier, à une place précise de sa journée.
 * C'est l'admin qui décide qui passe en premier et qui passe en
 * dernier — l'ouvrier ne fait que suivre l'ordre reçu.
 */
export async function affecterEtape(input: {
  stepId: string;
  workerId: string;
  jour?: string;
  ordreDuJour?: number | null;
  /** Temps estimé, en minutes. Sert de référence au classement. */
  minutesEstimees?: number | null;
}): Promise<{ ok: boolean; message: string }> {
  try {
    const jour = input.jour?.trim() || jourAujourdhui();
    if (!input.stepId || !input.workerId) return { ok: false, message: "Étape et ouvrier sont requis." };

    const sb: any = createServiceSupabase();
    const { data: step, error: eS } = await sb
      .from("work_order_steps")
      .select("id, atelier_id, step_name, estimated_minutes")
      .eq("id", input.stepId)
      .maybeSingle();
    if (eS) throw new Error(eS.message);
    if (!step) return { ok: false, message: "Étape introuvable." };

    let journeeId: string | null = null;
    const { data: journee } = await sb
      .from("journees_ouvrier")
      .select("id")
      .eq("jour", jour)
      .eq("worker_id", input.workerId)
      .maybeSingle();

    if (journee) journeeId = journee.id;
    else {
      // L'admin peut affecter avant la génération du matin : on
      // crée la journée au passage, les QR suivront.
      const { data: w } = await sb.from("profiles").select("atelier_id").eq("id", input.workerId).maybeSingle();
      const { data: creee, error: eC } = await sb
        .from("journees_ouvrier")
        .insert({ jour, worker_id: input.workerId, atelier_id: (w as any)?.atelier_id ?? step.atelier_id })
        .select("id")
        .maybeSingle();
      if (eC) throw new Error(eC.message);
      journeeId = (creee as any)?.id ?? null;
    }

    const { error: eI } = await sb.from("affectations_etape").insert({
      step_id: step.id,
      worker_id: input.workerId,
      atelier_id: step.atelier_id,
      journee_id: journeeId,
      ordre_du_jour: input.ordreDuJour ?? null,
    });
    if (eI) throw new Error(eI.message);

    await sb.from("work_order_steps").update({ worker_id: input.workerId }).eq("id", step.id);

    // Le temps estimé est la seule référence du classement : sans lui,
    // l'écart au temps prévu n'a aucun sens. On le saisit au moment de
    // l'affectation, quand l'admin a le poste en tête.
    let minutesPosees: number | null = null;
    if (input.minutesEstimees !== null && input.minutesEstimees !== undefined) {
      const m = num(input.minutesEstimees);
      if (m > 0) {
        const { error: eM } = await sb.from("work_order_steps").update({ estimated_minutes: Math.round(m) }).eq("id", step.id);
        if (eM) throw new Error(eM.message);
        minutesPosees = Math.round(m);
      }
    }

    revalidatePath("/admin/ouvriers");
    revalidatePath("/portal");
    return {
      ok: true,
      message:
        `« ${step.step_name} » affectée — l'ouvrier la verra sur son QR du jour.` +
        (minutesPosees !== null ? ` Temps estimé fixé à ${minutesPosees} min.` : ""),
    };
  } catch (e: any) {
    return { ok: false, message: errFr("Affectation d'étape", e) };
  }
}

/** Démarre le chronomètre d'une affectation. Le temps réel en découle. */
export async function demarrerAffectation(input: { affectationId: string }): Promise<{ ok: boolean; message: string }> {
  try {
    if (!input.affectationId?.trim()) return { ok: false, message: "Affectation introuvable." };
    const sb: any = createServiceSupabase();
    const now = new Date().toISOString();

    const { data: aff, error: eA } = await sb
      .from("affectations_etape")
      .select("id, step_id, debut_at")
      .eq("id", input.affectationId)
      .maybeSingle();
    if (eA) throw new Error(eA.message);
    if (!aff) return { ok: false, message: "Affectation introuvable." };
    if (aff.debut_at) return { ok: false, message: "Cette opération est déjà démarrée." };

    const { error: eU } = await sb.from("affectations_etape").update({ debut_at: now }).eq("id", aff.id);
    if (eU) throw new Error(eU.message);

    // L'étape passe en cours : c'est ce que voit l'admin sur son
    // tableau, et ce qui alimente le calcul d'atelier courant.
    const { error: eS } = await sb
      .from("work_order_steps")
      .update({ status: "ACTIVE", started_at: now })
      .eq("id", aff.step_id);
    if (eS) throw new Error(eS.message);

    revalidatePath("/portal");
    revalidatePath("/admin");
    return { ok: true, message: "Opération démarrée — le temps est compté." };
  } catch (e: any) {
    return { ok: false, message: errFr("Démarrage de l'opération", e) };
  }
}

// ═══════════════════════════════════════════════════════════
// 9. LE PILOTAGE — bilan, classement, sous-seuils, dette
// ═══════════════════════════════════════════════════════════

/**
 * Bilan d'une journée : ce qui est entré, sorti, réussi, perdu,
 * par atelier. C'est le bilan automatique demandé par
 * l'exploitant — aucune saisie manuelle.
 */
export async function bilanJournee(input: { jour?: string }): Promise<{
  ok: boolean;
  message: string;
  jour: string;
  lignes: Array<{
    atelierId: number | null;
    atelierCode: string | null;
    atelierNom: string | null;
    nbOuvriers: number;
    qtyPrise: number;
    qtyOk: number;
    qtyRebut: number;
    heuresTravail: number;
    tauxReussite: number | null;
  }>;
}> {
  const jour = input.jour?.trim() || jourAujourdhui();
  try {
    const sb: any = createServerSupabase();
    const { data, error } = await sb
      .from("v_bilan_journalier")
      .select("*")
      .eq("jour", jour)
      .order("atelier_id", { ascending: true, nullsFirst: false });
    if (error) throw new Error(error.message);

    // Le type est posé à la main : `data` vient d'un client Supabase
    // non typé (`any`), donc `.map()` propagerait `any` jusqu'au
    // `reduce` du message plus bas, qui deviendrait implicitement
    // `any` sous `strict`.
    const lignes: Array<{
      atelierId: number | null;
      atelierCode: string | null;
      atelierNom: string | null;
      nbOuvriers: number;
      qtyPrise: number;
      qtyOk: number;
      qtyRebut: number;
      heuresTravail: number;
      tauxReussite: number | null;
    }> = (data ?? []).map((l: any) => ({
      atelierId: l.atelier_id ?? null,
      atelierCode: l.atelier_code ?? null,
      atelierNom: l.atelier_nom ?? null,
      nbOuvriers: num(l.nb_ouvriers),
      qtyPrise: num(l.qty_prise),
      qtyOk: num(l.qty_ok),
      qtyRebut: num(l.qty_rebut),
      heuresTravail: Math.round((num(l.secondes_travail) / 3600) * 100) / 100,
      tauxReussite: l.taux_reussite === null || l.taux_reussite === undefined ? null : num(l.taux_reussite),
    }));

    return {
      ok: true,
      jour,
      lignes,
      message: lignes.length
        ? `Bilan du ${jour} : ${lignes.length} atelier(s), ${lignes.reduce((n, l) => n + l.qtyOk, 0)} pièce(s) réussie(s).`
        : `Aucune activité enregistrée le ${jour}.`,
    };
  } catch (e: any) {
    return { ok: false, message: errFr("Bilan journalier", e), jour, lignes: [] };
  }
}

/**
 * Classement des ouvriers — ADMIN UNIQUEMENT.
 *
 * Le contrôle est fait ICI, à l'entrée de l'action : la vue
 * `v_classement_ouvrier` est retirée des droits `anon` et
 * `authenticated` par la migration 0017, parce qu'une vue
 * Postgres ne respecte pas la RLS de ses tables sous-jacentes.
 * Seul le service_role peut la lire — donc seul le serveur, après
 * vérification du rôle.
 */
export async function classementOuvriers(input?: { limite?: number }): Promise<{
  ok: boolean;
  message: string;
  lignes: Array<{
    workerId: string;
    nom: string;
    atelierId: number | null;
    atelierCode: string | null;
    etapesTerminees: number;
    qtyOk: number;
    qtyRebut: number;
    tauxReussite: number | null;
    minutesTravail: number;
    minutesEstimees: number;
    ecartTemps: number | null;
  }>;
}> {
  try {
    const profil = await getProfil();
    if (profil.role !== "ADMIN")
      return { ok: false, message: "Le classement des ouvriers est réservé à l'administrateur.", lignes: [] };

    const sb: any = createServiceSupabase();
    const { data, error } = await sb
      .from("v_classement_ouvrier")
      .select("*")
      .order("qty_ok", { ascending: false })
      .limit(Math.max(1, Math.min(500, input?.limite ?? 100)));
    if (error) throw new Error(error.message);

    const lignes = (data ?? []).map((l: any) => {
      const minutesTravail = num(l.minutes_travail);
      const minutesEstimees = num(l.minutes_estimees);
      return {
        workerId: l.worker_id,
        nom: l.full_name ?? "Ouvrier",
        atelierId: l.atelier_id ?? null,
        atelierCode: l.atelier_code ?? null,
        etapesTerminees: num(l.etapes_terminees),
        qtyOk: num(l.qty_ok),
        qtyRebut: num(l.qty_rebut),
        tauxReussite: l.taux_reussite === null || l.taux_reussite === undefined ? null : num(l.taux_reussite),
        minutesTravail,
        minutesEstimees,
        // Écart au temps estimé : positif = plus lent que prévu.
        ecartTemps: minutesEstimees > 0 ? Math.round(minutesTravail - minutesEstimees) : null,
      };
    });

    return { ok: true, lignes, message: `${lignes.length} ouvrier(s) classé(s).` };
  } catch (e: any) {
    return { ok: false, message: errFr("Classement des ouvriers", e), lignes: [] };
  }
}

/** Stocks sous leur plancher : c'est cette liste qui déclenche la dette. */
export async function stocksSousSeuil(input?: { usine?: UsineCode }): Promise<{
  ok: boolean;
  message: string;
  lignes: Array<{ id: string; code: string; nom: string; depotCode: string; usine: string; dispo: number; reserve: number; min: number; max: number | null; manque: number }>;
}> {
  try {
    const sb: any = createServerSupabase();
    let q: any = sb.from("v_stocks_sous_seuil").select("*").order("manque", { ascending: false });
    if (input?.usine) q = q.eq("usine_code", input.usine);
    const { data, error } = await q;
    if (error) throw new Error(error.message);

    const lignes = (data ?? []).map((l: any) => ({
      // `id` est nécessaire pour pouvoir corriger le seuil depuis l'écran.
      id: l.id,
      code: l.code ?? l.name ?? "—",
      nom: l.name ?? "—",
      depotCode: l.depot_code ?? "—",
      usine: l.usine_code ?? "ADMEDCO",
      dispo: num(l.available),
      reserve: num(l.reserved),
      min: num(l.min_qty),
      max: l.max_qty === null || l.max_qty === undefined ? null : num(l.max_qty),
      manque: num(l.manque),
    }));

    return {
      ok: true,
      lignes,
      message: lignes.length
        ? `${lignes.length} article(s) sous leur plancher.`
        : "Aucun article sous son plancher.",
    };
  } catch (e: any) {
    return { ok: false, message: errFr("Stocks sous seuil", e), lignes: [] };
  }
}

/** Dette de production ouverte, par article : ce que la prochaine commande absorbera. */
export async function detteOuverte(input?: { usine?: UsineCode }): Promise<{
  ok: boolean;
  message: string;
  lignes: Array<{ articleId: string | null; usine: string; atelierId: number | null; depotCode: string | null; qtyDue: number; nbLignes: number; depuis: string | null }>;
}> {
  try {
    const sb: any = createServerSupabase();
    let q: any = sb.from("v_dette_par_article").select("*").order("plus_ancienne", { ascending: true });
    if (input?.usine) q = q.eq("usine_code", input.usine);
    const { data, error } = await q;
    if (error) throw new Error(error.message);

    const lignes = (data ?? []).map((l: any) => ({
      articleId: l.article_id ?? null,
      usine: l.usine_code ?? "ADMEDCO",
      atelierId: l.atelier_id ?? null,
      depotCode: l.depot_code ?? null,
      qtyDue: num(l.qty_due_totale),
      nbLignes: num(l.nb_lignes),
      depuis: l.plus_ancienne ?? null,
    }));

    return {
      ok: true,
      lignes,
      message: lignes.length
        ? `${lignes.length} article(s) en dette — la prochaine commande les absorbera.`
        : "Aucune dette de production ouverte.",
    };
  } catch (e: any) {
    return { ok: false, message: errFr("Dette de production", e), lignes: [] };
  }
}

// ═══════════════════════════════════════════════════════════
// 10. RÉFÉRENTIEL — ce que l'exploitant doit encore fournir
// ═══════════════════════════════════════════════════════════

/**
 * Enregistre le rendement matière : « une unité de cet article
 * donne N pièces ». C'est la donnée qui fait le pont entre une
 * commande de 300 chaises et le nombre de tubes à sortir du stock.
 *
 * Elle est propre à chaque usine — d'où `usineCode`.
 */
export async function enregistrerRendement(input: {
  usineCode: UsineCode;
  articleId: string;
  produitId?: string | null;
  unitesProduites: number;
  uniteMatiere?: string;
  uniteProduit?: string;
  note?: string;
}): Promise<{ ok: boolean; message: string }> {
  try {
    const profil = await getProfil();
    if (profil.role !== "ADMIN") return { ok: false, message: "Seul l'administrateur peut renseigner un rendement." };
    if (!(num(input.unitesProduites) > 0)) return { ok: false, message: "Le rendement doit être supérieur à zéro." };

    if (!input.articleId) return { ok: false, message: "Article de matière première requis." };

    const sb: any = createServiceSupabase();
    const ligne = {
      usine_code: input.usineCode,
      article_id: input.articleId,
      produit_id: input.produitId ?? null,
      unites_produites: num(input.unitesProduites),
      unite_matiere: input.uniteMatiere ?? "pcs",
      unite_produit: input.uniteProduit ?? "pcs",
      note: input.note ?? "",
      actif: true,
    };

    // ⚠️ On ne peut PAS utiliser `.upsert(..., { onConflict })` ici :
    //    l'unicité de `rendement_matiere` est portée par un index
    //    d'EXPRESSION — `COALESCE(produit_id, '0000…')` (migration
    //    0017) — parce qu'un `produit_id` NULL ne se compare pas à
    //    lui-même dans un index classique. PostgREST ne sait pas
    //    inférer un index d'expression et refuserait la requête.
    //    On cherche donc la ligne à la main, avec exactement la même
    //    sémantique : NULL ≡ « rendement global, tous produits
    //    confondus ».
    let q: any = sb
      .from("rendement_matiere")
      .select("id")
      .eq("usine_code", input.usineCode)
      .eq("article_id", input.articleId);
    q = ligne.produit_id === null ? q.is("produit_id", null) : q.eq("produit_id", ligne.produit_id);
    const { data: existante, error: eL } = await q.maybeSingle();
    if (eL) throw new Error(eL.message);

    const { error } = existante
      ? await sb.from("rendement_matiere").update(ligne).eq("id", existante.id)
      : await sb.from("rendement_matiere").insert(ligne);
    if (error) throw new Error(error.message);

    revalidatePath("/admin/rendements");
    return { ok: true, message: `Rendement enregistré : 1 unité → ${num(input.unitesProduites)} pièce(s) (${input.usineCode}).` };
  } catch (e: any) {
    return { ok: false, message: errFr("Enregistrement du rendement", e) };
  }
}

/** Fixe les seuils bas et haut d'un stock. Le plancher déclenche la dette. */
export async function fixerSeuils(input: {
  stockItemId: string;
  minQty: number | null;
  maxQty: number | null;
}): Promise<{ ok: boolean; message: string }> {
  try {
    const profil = await getProfil();
    if (profil.role !== "ADMIN") return { ok: false, message: "Seul l'administrateur peut fixer les seuils." };

    const sb: any = createServiceSupabase();
    const { error } = await sb
      .from("stock_items")
      .update({
        min_qty: input.minQty === null ? null : num(input.minQty),
        max_qty: input.maxQty === null ? null : num(input.maxQty),
      })
      .eq("id", input.stockItemId);
    if (error) throw new Error(error.message);

    revalidatePath("/admin/stocks");
    return {
      ok: true,
      message:
        input.minQty === null
          ? "Seuils retirés — cet article ne déclenche plus de dette."
          : `Seuils fixés : plancher ${num(input.minQty)}, plafond ${input.maxQty === null ? "aucun" : num(input.maxQty)}.`,
    };
  } catch (e: any) {
    return { ok: false, message: errFr("Fixation des seuils", e) };
  }
}

/** Rendement et nomenclature lisibles pour un produit — écran de contrôle. */
export async function nomenclatureProduit(input: { produitId: string; usine?: UsineCode }): Promise<{
  ok: boolean;
  message: string;
  produit?: { code: string; designation: string };
  besoins: Array<{ code: string; designation: string; brut: number; net: number; rendement: number; rendementRenseigne: boolean; unite: string; niveau: number }>;
  manquants: Array<{ code: string; manque: number; unite: string }>;
  avertissements: string[];
}> {
  try {
    if (!input.produitId) return { ok: false, message: "Produit requis.", besoins: [], manquants: [], avertissements: [] };
    const usine: UsineCode = input.usine ?? "ADMEDCO";
    const { ctx, avertissements } = await chargerContexteAgent(usine);
    const produit = ctx.articles.get(input.produitId);
    if (!produit) return { ok: false, message: "Article introuvable dans la nomenclature.", besoins: [], manquants: [], avertissements };

    const plan = planifierMatiere(input.produitId, 1, ctx);
    return {
      ok: true,
      produit: { code: produit.code, designation: produit.designation },
      besoins: plan.besoins.map((b) => ({
        code: b.code,
        designation: b.designation,
        brut: b.quantiteBrute,
        net: b.quantiteNette,
        rendement: b.rendementApplique,
        rendementRenseigne: b.rendementRenseigne,
        unite: b.unite,
        niveau: b.niveau,
      })),
      manquants: plan.manquants.map((m) => ({ code: m.code, manque: m.manque, unite: m.unite })),
      avertissements,
      message: `Pour 1 ${produit.code || produit.designation} : ${plan.besoins.length} matière(s) consommée(s).`,
    };
  } catch (e: any) {
    return { ok: false, message: errFr("Lecture de la nomenclature", e), besoins: [], manquants: [], avertissements: [] };
  }
}

/** L'atelier et le dépôt de matière première d'une usine — pour les écrans. */
export async function referentielUsine(input: { usine: UsineCode }): Promise<{
  ok: boolean;
  message: string;
  depotMP: string;
  ateliers: Array<{ id: number; code: string; nom: string }>;
}> {
  try {
    const sb: any = createServerSupabase();
    const { data, error } = await sb.from("ateliers").select("id, code, name, site").eq("site", input.usine).order("id");
    if (error) throw new Error(error.message);
    return {
      ok: true,
      depotMP: depotMP(input.usine),
      ateliers: (data ?? []).map((a: any) => ({ id: num(a.id), code: a.code ?? "", nom: a.name ?? "" })),
      message: `${input.usine} : ${(data ?? []).length} atelier(s), matière première au dépôt ${depotMP(input.usine)}.`,
    };
  } catch (e: any) {
    return { ok: false, message: errFr("Référentiel usine", e), depotMP: depotMP(input.usine), ateliers: [] };
  }
}

// ═══════════════════════════════════════════════════════════
// 9. LE SIMULATEUR — voir la chaîne AVANT de la lancer
// ═══════════════════════════════════════════════════════════

/**
 * Rejoue à blanc le lancement d'une production, SANS RIEN ÉCRIRE.
 *
 * ── Pourquoi cet écran existe ──
 *
 * Entre le clic sur « lancer en production » et la première pièce
 * qui sort de l'atelier, il n'y a aucun retour. Une nomenclature
 * incomplète côté Silwane, un composant classé du mauvais côté du
 * triage : la pièce part alors au mauvais atelier, matière déjà
 * engagée, et on ne le découvre qu'au poste.
 *
 * Le simulateur déroule EXACTEMENT les fonctions du lancement réel
 * — `trierCommande`, `routePour`, `planifierMatiere` — puis
 * s'arrête avant la première écriture. Ce qu'il affiche est donc ce
 * que la production fera, pas une maquette.
 *
 * ⚠️ Lecture seule : aucun insert, aucun `revalidatePath`.
 */
export async function simulerCommande(input: {
  articleId: string;
  quantite: number;
}): Promise<{
  ok: boolean;
  message: string;
  produit?: { code: string; designation: string; unite: string };
  parts: Array<{
    usineCode: UsineCode;
    parcours: ParcoursProduit;
    destination: string;
    nbEtapes: number;
    ateliers: Array<{ atelierId: number; nom: string; nbEtapes: number }>;
    etapes: Array<{
      sequence: number;
      ordreAtelier: number;
      atelierId: number;
      atelier: string;
      code: string;
      nom: string;
      depotSortie: string | null;
    }>;
    composants: Array<{ code: string; designation: string }>;
  }>;
  nonClassee: Array<{ code: string; designation: string }>;
  matieres: Array<{
    code: string;
    designation: string;
    brut: number;
    net: number;
    rendement: number;
    rendementRenseigne: boolean;
    unite: string;
  }>;
  manquants: Array<{ code: string; manque: number; unite: string }>;
  avertissements: string[];
}> {
  const vide = (message: string, avertissements: string[] = []) => ({
    ok: false,
    message,
    parts: [],
    nonClassee: [],
    matieres: [],
    manquants: [],
    avertissements,
  });

  try {
    if (!input.articleId) return vide("Produit requis.");
    const qty = Math.floor(num(input.quantite));
    if (!(qty > 0)) return vide("Quantité invalide : indiquez un nombre de pièces supérieur à zéro.");

    // Chaque usine a son stock et ses rendements : le triage lit les
    // articles (identiques dans les deux contextes), mais la
    // disponibilité matière se juge usine par usine.
    const [adm, mbx] = await Promise.all([
      chargerContexteAgent("ADMEDCO"),
      chargerContexteAgent("MOBILIX"),
    ]);
    const avertissements = [...new Set([...adm.avertissements, ...mbx.avertissements])];

    const produit = adm.ctx.articles.get(input.articleId);
    if (!produit) return vide("Article introuvable dans le référentiel.", avertissements);

    const triage = trierCommande(input.articleId, qty, adm.ctx);

    const parts = triage.repartitions.map((r) => {
      const route = routePour(r.parcours);
      const charge = chargeParAtelier(r.parcours);
      return {
        usineCode: r.usineCode,
        parcours: r.parcours,
        destination: destinationPart(r.usineCode, triage),
        nbEtapes: route.length,
        ateliers: Object.entries(charge)
          .map(([id, n]) => ({ atelierId: Number(id), nom: atelierNom(Number(id)), nbEtapes: n }))
          .sort((a, b) => a.atelierId - b.atelierId),
        etapes: route.map((e) => ({
          sequence: e.sequence,
          ordreAtelier: e.ordreAtelier,
          atelierId: e.atelier,
          atelier: atelierNom(e.atelier),
          code: e.code,
          nom: e.nom,
          depotSortie: e.depotSortie,
        })),
        composants: r.composants.map((c) => ({ code: c.code, designation: c.designation })),
      };
    });

    // Le plan matière est calculé sur le contexte ADMEDCO : c'est
    // l'usine qui monte le produit fini et qui porte l'essentiel des
    // matières premières. La répartition des composants par usine
    // reste lisible sur chaque part, via `composants`.
    const plan = planifierMatiere(input.articleId, qty, adm.ctx);

    return {
      ok: true,
      message:
        `Simulation — ${produit.code || produit.designation} ×${qty} : ` +
        `${parts.length} ordre(s) de fabrication, ` +
        `${parts.reduce((n, p) => n + p.nbEtapes, 0)} étape(s) au total.`,
      produit: { code: produit.code, designation: produit.designation, unite: produit.unite },
      parts,
      nonClassee: triage.nonClassee.map((c) => ({ code: c.code, designation: c.designation })),
      matieres: plan.besoins.map((b) => ({
        code: b.code,
        designation: b.designation,
        brut: b.quantiteBrute,
        net: b.quantiteNette,
        rendement: b.rendementApplique,
        rendementRenseigne: b.rendementRenseigne,
        unite: b.unite,
      })),
      manquants: plan.manquants.map((m) => ({ code: m.code, manque: m.manque, unite: m.unite })),
      avertissements,
    };
  } catch (e: any) {
    return vide(errFr("Simulation", e));
  }
}
