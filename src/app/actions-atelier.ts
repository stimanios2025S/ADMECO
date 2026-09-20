"use server";

// ═══════════════════════════════════════════════════════════
// LE PORTAIL D'UN ATELIER — ce que l'ouvrier peut FAIRE
//
// ── La règle qui gouverne tout ce fichier ──
//
// Un ouvrier ne travaille que sur SON atelier. Le slug de l'URL ne
// suffit pas à l'autoriser : chaque action revérifie côté serveur que
// l'étape visée appartient bien à l'atelier du profil connecté.
// Sinon un ouvrier de l'Atelier 1 pourrait déclarer une étape de
// poudrage en changeant l'identifiant dans la requête.
//
//   ADMIN      → tous les ateliers (il dépanne, il ne produit pas)
//   WORKER     → son atelier, et lui seul
//   MAGASINIER → aucun (son espace est /admin/reception)
//
// ── Les trois gestes de l'ouvrier ──
//
//   COMMENCER  l'étape passe ACTIVE, l'horloge part.
//   TERMINER   il déclare ce qu'il a pris, réussi, perdu. L'étape
//              passe DONE et sort de sa liste.
//   PARQUER    il range la pièce et reprendra. L'étape reste ACTIVE
//              mais sort de sa liste du jour, et un parcage est créé.
// ═══════════════════════════════════════════════════════════

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceSupabase } from "@/lib/supabase/service";
import { getProfil, type Profil } from "@/lib/auth";
import type { AtelierId } from "@/lib/ateliers";
import { atelierDuSlug, ficheAtelier, urlAtelier, FICHES_ATELIERS } from "@/lib/portail-atelier";
import { declarerEtape } from "./actions-workflow";

// ── Une tâche, telle que l'ouvrier la lit ──
export type Tache = {
  stepId: string;
  itemId: string;
  orderId: string;
  orderNumber: string;
  clientNom: string | null;
  /** « CHG 021 — Chaise G21 », ou le libellé de la commande à défaut. */
  produit: string;
  articleCode: string | null;
  /** Le nom du poste tel qu'il a été écrit au lancement. */
  poste: string;
  /** Numérotation LOCALE à l'atelier — ce que l'ouvrier appelle son étape. */
  ordre: number;
  /** Numérotation GLOBALE du parcours — sert à savoir ce qui vient avant. */
  sequence: number;
  statut: "PENDING" | "ACTIVE" | "DONE" | "SKIPPED";
  /** Quantité attendue par l'étape. */
  cible: number;
  /** Quantité de la commande entière. */
  quantiteCommande: number;
  avancement: { faites: number; total: number };
  /** L'atelier qui prend la suite, pour prévenir l'ouvrier. */
  atelierSuivant: AtelierId | null;
  commenceA: string | null;
  minutesEstimees: number | null;
  /** Réellement travaillé par MOI (ou par personne encore). */
  aMoi: boolean;
  ouvrier: string | null;
  /** Échéance de la commande : sert à signaler l'urgence. */
  echeance: string | null;
  /**
   * L'étape peut-elle être ouverte ?
   * Non tant qu'une étape AMONT du même parcours n'est pas terminée :
   * on ne soude pas une pièce qui n'est pas coupée. Les étapes
   * parallèles (MOBILIX entrelace M1 et M2) ne se bloquent pas entre
   * ateliers différents.
   */
  bloquee: boolean;
  bloquePar: string | null;
};

export type StatsAtelier = {
  /** Étapes que MOI j'ai terminées depuis minuit. */
  finiesAujourdhui: number;
  /** Pièces réussies depuis minuit, tous ouvriers de l'atelier. */
  piecesAujourdhui: number;
  /** Pièces perdues depuis minuit — le chiffre que le chef regarde. */
  rebutAujourdhui: number;
};

export type ReponseTaches =
  | {
      ok: true;
      taches: Tache[];
      fiche: ReturnType<typeof ficheAtelier>;
      profil: Profil;
      stats: StatsAtelier;
    }
  | { ok: false; message: string };

// ═══════════════════════════════════════════════════════════
// LE GARDE-FOU
// ═══════════════════════════════════════════════════════════

type Acces =
  | { ok: true; profil: Profil; atelierId: AtelierId }
  | { ok: false; message: string };

/**
 * Vérifie que le profil connecté a le droit d'ouvrir CET atelier.
 * `slugDemande` vient de l'URL — donc jamais digne de confiance.
 */
export async function verifierAccesAtelier(slugDemande: string): Promise<Acces> {
  const cible = atelierDuSlug(slugDemande);
  if (!cible) {
    return { ok: false, message: `Atelier inconnu : « ${slugDemande} ».` };
  }

  const profil = await getProfil();
  if (!profil.email) {
    return { ok: false, message: "Vous n'êtes pas connecté." };
  }

  if (profil.role === "ADMIN") {
    return { ok: true, profil, atelierId: cible };
  }

  if (profil.role === "MAGASINIER") {
    return {
      ok: false,
      message: "Un magasinier n'a pas de poste de production. Son espace est la Réception MP.",
    };
  }

  // ── WORKER : son atelier, et rien d'autre ──
  if (!profil.atelier_id) {
    return {
      ok: false,
      message:
        "Votre compte n'est rattaché à aucun atelier. Demandez à l'administrateur de vous affecter un poste (Équipe).",
    };
  }

  if (profil.atelier_id !== cible) {
    const mien = ficheAtelier(profil.atelier_id);
    const demande = ficheAtelier(cible);
    return {
      ok: false,
      message: `Vous êtes affecté à ${mien?.nom ?? "un autre atelier"}. Le portail ${demande?.nom ?? slugDemande} ne vous est pas ouvert.`,
    };
  }

  return { ok: true, profil, atelierId: cible };
}

// ── Le pendant « action » : on ne se contente pas du slug, on
//    remonte jusqu'à work_order_steps.atelier_id ──
async function etapeAutorisee(
  stepId: string,
): Promise<{ ok: true; profil: Profil; atelierId: number; nom: string } | { ok: false; message: string }> {
  if (!stepId?.trim()) return { ok: false, message: "Étape introuvable." };

  const profil = await getProfil();
  if (!profil.email) return { ok: false, message: "Vous n'êtes pas connecté." };
  if (profil.role === "MAGASINIER") return { ok: false, message: "Votre espace est la Réception MP." };

  const sb: any = createServiceSupabase();
  const { data: step, error } = await sb
    .from("work_order_steps")
    .select("id, atelier_id, step_name")
    .eq("id", stepId)
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!step) return { ok: false, message: "Cette étape n'existe plus." };

  if (profil.role !== "ADMIN" && profil.atelier_id !== step.atelier_id) {
    return {
      ok: false,
      message: `Cette étape est à ${ficheAtelier(step.atelier_id)?.nom ?? "un autre atelier"} — pas au vôtre.`,
    };
  }

  return { ok: true, profil, atelierId: step.atelier_id, nom: step.step_name };
}

// ═══════════════════════════════════════════════════════════
// LIRE LES TÂCHES D'UN ATELIER
// ═══════════════════════════════════════════════════════════

const PAGE = 1000;

async function lireTout(supabase: any, table: string, select: string): Promise<any[]> {
  const out: any[] = [];
  for (let debut = 0; debut < 100_000; debut += PAGE) {
    const { data, error } = await supabase.from(table).select(select).range(debut, debut + PAGE - 1);
    if (error) throw new Error(`${table} : ${error.message}`);
    // `page` et non `lignes` : le nom est déjà pris par le garde-fou
    // de forme au bas de ce fichier, et le masquer ici rendrait la
    // relecture trompeuse.
    const page = Array.isArray(data) ? (data as any[]) : [];
    out.push(...page);
    if (page.length < PAGE) break;
  }
  return out;
}

/**
 * Lit les étapes d'un LOT d'articles.
 *
 * On découpe en paquets de 40 identifiants : une clause `in` avec 300
 * identifiants produit une URL de plusieurs kilo-octets, que le proxy
 * refuse (414). Et on pagine à l'intérieur de chaque paquet, parce que
 * PostgREST plafonne à 1000 lignes : un lot de 40 pièces à 12 étapes
 * en compte 480, ce qui passe — mais un atelier bien chargé non.
 */
async function etapesDesItems(supabase: any, itemIds: string[]): Promise<any[]> {
  const out: any[] = [];
  const LOT = 40;
  for (let i = 0; i < itemIds.length; i += LOT) {
    const paquet = itemIds.slice(i, i + LOT);
    for (let debut = 0; debut < 5000; debut += PAGE) {
      const { data, error } = await supabase
        .from("work_order_steps")
        .select("id, item_id, sequence, step_name, status, atelier_id")
        .in("item_id", paquet)
        // `sequence` n'est pas unique entre articles : sans second
        // critère, deux pages successives peuvent renvoyer la même
        // ligne et en oublier une autre.
        .order("sequence", { ascending: true })
        .order("id", { ascending: true })
        .range(debut, debut + PAGE - 1);
      if (error) throw new Error(`work_order_steps : ${error.message}`);
      const page = Array.isArray(data) ? (data as any[]) : [];
      out.push(...page);
      if (page.length < PAGE) break;
    }
  }
  return out;
}

/**
 * Les tâches vivantes d'un atelier : ce qui est à faire et ce qui est
 * en cours. Les étapes terminées ne sont pas listées une par une —
 * elles sont comptées dans `avancement`, sinon la liste de l'ouvrier
 * se remplit d'historique et il ne voit plus son travail du jour.
 */
export async function tachesAtelier(slug: string): Promise<ReponseTaches> {
  try {
    const acces = await verifierAccesAtelier(slug);
    if (!acces.ok) return { ok: false, message: acces.message };

    const { profil, atelierId } = acces;
    const fiche = ficheAtelier(atelierId);
    // Lecture authentifiée (la RLS autorise la lecture à tout
    // utilisateur connecté) — pas de clé de service ici, ce n'est
    // qu'une lecture.
    const sb: any = createServerSupabase();

    // 1. Les étapes de CET atelier, hors terminées.
    const { data: steps, error: eS } = await sb
      .from("work_order_steps")
      .select(
        "id, item_id, step_order, sequence, step_name, status, estimated_minutes, started_at, worker_id, target_qty",
      )
      .eq("atelier_id", atelierId)
      .in("status", ["PENDING", "ACTIVE"])
      .order("sequence", { ascending: true })
      .limit(300);
    if (eS) throw new Error(eS.message);

    // 2. Le compteur du jour — c'est ce que l'ouvrier regarde en
    //    arrivant, et ce qu'il compare le soir. On le calcule même
    //    quand sa file est vide, sinon un atelier à jour afficherait
    //    « 0 » au lieu de son vrai bilan.
    const stats = await statsDuJour(sb, atelierId, profil.id);

    const etapes = lignes(steps);
    if (etapes.length === 0) {
      return { ok: true, taches: [], fiche, profil, stats };
    }

    const itemIds = [...new Set(etapes.map((e) => e.item_id as string))];
    const stepIds = etapes.map((e) => e.id as string);

    // 2. Les articles concernés, leurs commandes, et TOUTES leurs
    //    étapes vivantes (pas seulement celles de cet atelier : c'est
    //    ce qui permet de dire « l'étape d'avant n'est pas finie »).
    const [{ data: items, error: eI }, tousSteps] = await Promise.all([
      sb
        .from("work_order_items")
        .select("id, order_id, product_name, quantity, steps_completed, steps_total, article_id")
        .in("id", itemIds),
      etapesDesItems(sb, itemIds),
    ]);
    if (eI) throw new Error(eI.message);

    const itemsTab = lignes(items);
    const orderIds = [...new Set(itemsTab.map((i) => i.order_id as string).filter(Boolean))];

    // ⚠️ Chaque membre de ce Promise.all doit être déstructuré selon
    //    ce qu'il RÉSOUT. `lireTout` résout un tableau ; un
    //    `.select()` de supabase-js résout une enveloppe
    //    `{ data, error }`. Les mettre côte à côte sans le dire est
    //    exactement ce qui a cassé cette page : `ouvriers` recevait
    //    l'enveloppe, et `(ouvriers ?? []).map` n'était pas une
    //    fonction.
    const [
      { data: orders, error: eO },
      articles,
      { data: ouvriers, error: eW },
    ] = await Promise.all([
      sb
        .from("work_orders")
        .select("id, order_number, due_at, usine_code, commande_client_id")
        .in("id", orderIds),
      // Le code Silwane de l'article — c'est lui que l'ouvrier reconnaît,
      // pas le libellé long recopié dans product_name.
      lireTout(sb, "erp_articles", "id,code,designation"),
      // `profiles` ne porte PAS l'adresse e-mail : elle vit dans
      // auth.users, que la clé de service seule peut lire. On s'en
      // tient donc au nom, avec un repli neutre.
      sb.from("profiles").select("id, full_name"),
    ]);
    if (eO) throw new Error(eO.message);
    if (eW) throw new Error(eW.message);

    // ── Le client ──
    // L'ouvrier ne travaille pas « pour la commande OF-2026-118 » : il
    // travaille pour quelqu'un. Le nom est peu coûteux à joindre et il
    // change la façon dont on lit une fiche. Il est facultatif : une
    // commande interne n'a pas de client.
    const commandeClientIds = [
      ...new Set(lignes(orders).map((o) => o.commande_client_id).filter(Boolean)),
    ] as string[];
    const nomClient = new Map<string, string>();
    if (commandeClientIds.length) {
      const { data: clients } = await sb
        .from("commandes_client")
        .select("id, client_nom")
        .in("id", commandeClientIds);
      for (const c of lignes(clients)) {
        if (c.client_nom) nomClient.set(c.id as string, c.client_nom as string);
      }
    }

    const parItem = new Map<string, any>(itemsTab.map((i) => [i.id as string, i]));
    const parOrder = new Map<string, any>(lignes(orders).map((o) => [o.id as string, o]));
    const parArticle = new Map<string, any>(lignes(articles).map((a) => [a.id as string, a]));
    const parOuvrier = new Map<string, any>(lignes(ouvriers).map((w) => [w.id as string, w]));

    // Toutes les étapes d'un article, pour mesurer l'avancement et
    // détecter ce qui bloque.
    const etapesParItem = new Map<string, any[]>();
    for (const s of lignes(tousSteps)) {
      const l = etapesParItem.get(s.item_id as string) ?? [];
      l.push(s);
      etapesParItem.set(s.item_id as string, l);
    }

    const mesStepIds = new Set(stepIds);
    const maintenant = Date.now();

    const taches: Tache[] = etapes.map((s) => {
      const item = parItem.get(s.item_id as string);
      const order = item ? parOrder.get(item.order_id as string) : null;
      const article = item?.article_id ? parArticle.get(item.article_id as string) : null;
      const duMemeItem = etapesParItem.get(s.item_id as string) ?? [];

      // ── Ce qui bloque ──
      // La première étape encore ouverte AVANT celle-ci, dans l'ordre
      // global du parcours. On ne regarde QUE les étapes du même
      // article : c'est le seul chaînage qui existe réellement.
      const avant = duMemeItem.filter(
        (x) => Number(x.sequence ?? 0) < Number(s.sequence ?? 0) && x.status !== "DONE" && x.status !== "SKIPPED",
      );
      const bloquante = avant[0] ?? null;

      const faites = duMemeItem.filter((x) => x.status === "DONE").length;

      const produit = article
        ? `${article.code ?? ""}${article.designation ? ` — ${article.designation}` : ""}`.trim()
        : (item?.product_name ?? "Article sans nom");

      const ouvrier = s.worker_id ? parOuvrier.get(s.worker_id as string) : null;

      return {
        stepId: s.id as string,
        itemId: s.item_id as string,
        orderId: (item?.order_id ?? "") as string,
        orderNumber: (order?.order_number ?? "—") as string,
        clientNom: (order?.commande_client_id ? nomClient.get(order.commande_client_id) ?? null : null) as
          | string
          | null,
        produit,
        articleCode: (article?.code ?? null) as string | null,
        poste: (s.step_name ?? "Poste") as string,
        ordre: Number(s.step_order ?? 0),
        sequence: Number(s.sequence ?? 0),
        statut: s.status as Tache["statut"],
        cible: Number(s.target_qty ?? item?.quantity ?? 0),
        quantiteCommande: Number(item?.quantity ?? 0),
        avancement: { faites, total: duMemeItem.length || Number(item?.steps_total ?? 0) },
        atelierSuivant: null,
        commenceA: (s.started_at ?? null) as string | null,
        minutesEstimees: s.estimated_minutes === null ? null : Number(s.estimated_minutes),
        aMoi: s.worker_id === profil.id,
        ouvrier: (ouvrier?.full_name ?? null) as string | null,
        echeance: (order?.due_at ?? null) as string | null,
        bloquee: bloquante !== null,
        bloquePar: bloquante ? (bloquante.step_name as string) : null,
      };
    });

    // ── L'atelier suivant ──
    // Ce n'est pas « l'atelier numéro +1 » : sur MOBILIX, M2 → M1 → M2.
    // On le lit donc dans le parcours réel de l'article, à la
    // séquence immédiatement supérieure.
    for (const t of taches) {
      const duMemeItem = etapesParItem.get(t.itemId) ?? [];
      const apres = duMemeItem.find((x) => Number(x.sequence ?? 0) > t.sequence);
      t.atelierSuivant = apres ? (Number(apres.atelier_id) as AtelierId) : null;
    }

    // ── Le tri ──
    // 1. Ce que MOI j'ai commencé — je le finis.
    // 2. Ce qui est débloqué et en attente, dans l'ordre du parcours.
    // 3. Ce qui est bloqué en amont, à la fin.
    // Les tâches qui traînent depuis le plus longtemps passent devant :
    // une pièce ouverte depuis trois jours bloque la chaîne.
    taches.sort((a, b) => {
      const rang = (t: Tache) => (t.aMoi && t.statut === "ACTIVE" ? 0 : t.bloquee ? 2 : 1);
      if (rang(a) !== rang(b)) return rang(a) - rang(b);
      if (rang(a) === 1 && a.statut !== b.statut) return a.statut === "ACTIVE" ? -1 : 1;
      const age = (t: Tache) => (t.commenceA ? new Date(t.commenceA).getTime() : maintenant);
      if (a.bloquee !== b.bloquee) return a.bloquee ? 1 : -1;
      return age(a) - age(b);
    });

    return { ok: true, taches, fiche, profil, stats };
  } catch (e: any) {
    return { ok: false, message: e?.message ?? String(e) };
  }
}

/**
 * Le bilan de la journée pour un atelier.
 *
 * Le jour est découpé en HEURE LOCALE, pas en UTC : minuit UTC tombe à
 * 1 h du matin en Algérie, ce qui ferait basculer le compteur en plein
 * poste de nuit et afficherait « 0 » au réveil.
 */
async function statsDuJour(sb: any, atelierId: number, workerId: string): Promise<StatsAtelier> {
  const vide: StatsAtelier = { finiesAujourdhui: 0, piecesAujourdhui: 0, rebutAujourdhui: 0 };
  try {
    const debut = new Date();
    debut.setHours(0, 0, 0, 0);

    const { data, error } = await sb
      .from("work_order_steps")
      .select("worker_id, quantity_ok, quantity_rebut")
      .eq("atelier_id", atelierId)
      .eq("status", "DONE")
      .gte("completed_at", debut.toISOString())
      .limit(2000);
    if (error) return vide;

    let finies = 0;
    let ok = 0;
    let rebut = 0;
    for (const s of lignes(data)) {
      if (s.worker_id === workerId) finies++;
      ok += nombre(s.quantity_ok);
      rebut += nombre(s.quantity_rebut);
    }
    return { finiesAujourdhui: finies, piecesAujourdhui: ok, rebutAujourdhui: rebut };
  } catch {
    // Un compteur ne doit jamais empêcher l'atelier d'ouvrir.
    return vide;
  }
}

// ═══════════════════════════════════════════════════════════
// COMMENCER
// ═══════════════════════════════════════════════════════════
/**
 * L'ouvrier prend l'étape : elle passe ACTIVE, l'horloge démarre, et
 * une affectation nominative est ouverte (c'est elle qui alimentera le
 * classement et le temps réel — pas une saisie manuelle).
 *
 * Idempotent : recliquer sur une étape déjà commencée par soi ne
 * redémarre pas l'horloge, sinon chaque clic remettrait le compteur à
 * zéro et le temps mesuré serait faux.
 */
export async function commencerTache(input: {
  stepId: string;
}): Promise<{ ok: boolean; message: string }> {
  try {
    const droit = await etapeAutorisee(input.stepId);
    if (!droit.ok) return { ok: false, message: droit.message };

    const sb: any = createServiceSupabase();
    const { data: step, error } = await sb
      .from("work_order_steps")
      .select("id, step_name, status, atelier_id, started_at, worker_id")
      .eq("id", input.stepId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!step) return { ok: false, message: "Cette étape n'existe plus." };
    if (step.status === "DONE") return { ok: false, message: "Cette étape est déjà terminée." };

    // Déjà à moi et déjà lancée : on ne touche à rien.
    if (step.status === "ACTIVE" && step.worker_id === droit.profil.id) {
      return { ok: true, message: `« ${step.step_name} » est déjà en cours pour vous.` };
    }

    // Quelqu'un d'autre l'a prise : on le dit au lieu d'écraser son travail.
    if (step.status === "ACTIVE" && step.worker_id && step.worker_id !== droit.profil.id) {
      const { data: autre } = await sb
        .from("profiles")
        .select("full_name")
        .eq("id", step.worker_id)
        .maybeSingle();
      const nom = (autre as any)?.full_name || "un autre ouvrier";
      return {
        ok: false,
        message: `« ${step.step_name} » est déjà en cours avec ${nom}. Demandez-lui où il en est avant de la reprendre.`,
      };
    }

    const now = new Date().toISOString();
    const { error: eU } = await sb
      .from("work_order_steps")
      .update({ status: "ACTIVE", started_at: step.started_at ?? now, worker_id: droit.profil.id })
      .eq("id", step.id);
    if (eU) throw new Error(eU.message);

    // ── L'affectation nominative ──
    // Elle reste ouverte (fin_at nul) jusqu'à la déclaration. Le
    // déclencheur calc_duree_affectation en déduira la durée. Si elle a
    // déjà été ouverte, on n'en crée pas une deuxième : deux lignes
    // ouvertes sur la même étape fausseraient le classement.
    try {
      const { data: deja } = await sb
        .from("affectations_etape")
        .select("id")
        .eq("step_id", step.id)
        .eq("worker_id", droit.profil.id)
        .is("fin_at", null)
        .maybeSingle();

      if (!deja) {
        // Rattacher à la journée de l'ouvrier si elle a été générée
        // (QR du matin) ; sinon l'affectation vit sans journée.
        const jour = now.slice(0, 10);
        const { data: journee } = await sb
          .from("journees_ouvrier")
          .select("id")
          .eq("jour", jour)
          .eq("worker_id", droit.profil.id)
          .maybeSingle();

        await sb.from("affectations_etape").insert({
          step_id: step.id,
          worker_id: droit.profil.id,
          atelier_id: step.atelier_id,
          journee_id: (journee as any)?.id ?? null,
        });
      }
    } catch {
      /* Le suivi du temps ne doit jamais empêcher de produire. */
    }

    revalider();
    return { ok: true, message: `« ${step.step_name} » commencée — le temps est compté.` };
  } catch (e: any) {
    return { ok: false, message: e?.message ?? String(e) };
  }
}

// ═══════════════════════════════════════════════════════════
// TERMINER — la déclaration de fin de poste
// ═══════════════════════════════════════════════════════════
/**
 * L'ouvrier déclare ce qu'il a PRIS, RÉUSSI et PERDU.
 *
 * Le contrôle de cohérence est ici, pas seulement dans l'action
 * métier : « réussi + perdu » ne peut pas dépasser « pris ». Un
 * ouvrier qui se trompe de champ doit le savoir avant d'envoyer, pas
 * après.
 */
export async function terminerTache(input: {
  stepId: string;
  pris: number;
  ok: number;
  rebut?: number;
}): Promise<{ ok: boolean; message: string }> {
  try {
    const droit = await etapeAutorisee(input.stepId);
    if (!droit.ok) return { ok: false, message: droit.message };

    const pris = nombre(input.pris);
    const ok = nombre(input.ok);
    const rebut = nombre(input.rebut);

    if (pris < 0 || ok < 0 || rebut < 0) {
      return { ok: false, message: "Les quantités ne peuvent pas être négatives." };
    }
    if (ok + rebut > pris + 0.0001) {
      return {
        ok: false,
        message: `Incohérence : ${ok} réussi(s) + ${rebut} perdu(s) dépasse les ${pris} pris. Corrigez avant d'envoyer.`,
      };
    }
    if (ok + rebut < pris - 0.0001) {
      return {
        ok: false,
        message: `${pris} pris mais ${ok + rebut} compté(s). Il manque ${arrondi(pris - ok - rebut)} pièce(s) : dites ce qu'elles sont devenues (réussies ou perdues).`,
      };
    }

    // On passe par l'action métier existante : elle sait déjà poser
    // les quantités, fermer l'affectation ouverte, calculer le temps
    // réel et mettre à jour le statut de l'étape. La réécrire ici
    // créerait deux vérités.
    const r = await declarerEtape({
      stepId: input.stepId,
      quantityTaken: pris,
      quantityOk: ok,
      quantityRebut: rebut,
      workerId: droit.profil.id,
    });
    if (!r.ok) return r;

    revalider();
    return r;
  } catch (e: any) {
    return { ok: false, message: e?.message ?? String(e) };
  }
}

// ═══════════════════════════════════════════════════════════
// PARQUER — la pièce est rangée, on reprendra
// ═══════════════════════════════════════════════════════════
export async function parquerTache(input: {
  stepId: string;
  pris: number;
  ok: number;
  rebut?: number;
  motif: string;
}): Promise<{ ok: boolean; message: string }> {
  try {
    const droit = await etapeAutorisee(input.stepId);
    if (!droit.ok) return { ok: false, message: droit.message };

    const motif = (input.motif ?? "").trim();
    if (motif.length < 3) {
      return { ok: false, message: "Indiquez pourquoi la pièce est mise de côté — c'est ce que lira le chef d'atelier." };
    }

    const r = await declarerEtape({
      stepId: input.stepId,
      quantityTaken: nombre(input.pris),
      quantityOk: nombre(input.ok),
      quantityRebut: nombre(input.rebut),
      motif,
      workerId: droit.profil.id,
      parquer: true,
    });
    if (!r.ok) return r;

    revalider();
    return r;
  } catch (e: any) {
    return { ok: false, message: e?.message ?? String(e) };
  }
}

// ═══════════════════════════════════════════════════════════
// REPRENDRE — on peut aussi se raviser et laisser l'étape
// ═══════════════════════════════════════════════════════════
/**
 * L'ouvrier a cliqué « Commencer » par erreur, ou il part en pause : il
 * rend l'étape. Elle repasse PENDING et retourne dans la file de
 * l'atelier, disponible pour lui comme pour un collègue.
 *
 * On REFUSE si du travail a déjà été déclaré : une étape avec des
 * quantités saisies n'est plus une erreur de clic.
 */
export async function lacherTache(input: { stepId: string }): Promise<{ ok: boolean; message: string }> {
  try {
    const droit = await etapeAutorisee(input.stepId);
    if (!droit.ok) return { ok: false, message: droit.message };

    const sb: any = createServiceSupabase();
    const { data: step } = await sb
      .from("work_order_steps")
      .select("id, step_name, status, worker_id, quantity_ok, quantity_taken, quantity_rebut")
      .eq("id", input.stepId)
      .maybeSingle();

    if (!step) return { ok: false, message: "Cette étape n'existe plus." };
    if (step.worker_id !== droit.profil.id && droit.profil.role !== "ADMIN") {
      return { ok: false, message: "Vous n'avez pas commencé cette étape." };
    }
    if (nombre(step.quantity_taken) > 0 || nombre(step.quantity_ok) > 0 || nombre(step.quantity_rebut) > 0) {
      return {
        ok: false,
        message: "Des quantités ont déjà été déclarées sur cette étape : elle ne peut plus être simplement relâchée.",
      };
    }

    const { error } = await sb
      .from("work_order_steps")
      .update({ status: "PENDING", started_at: null, worker_id: null })
      .eq("id", step.id);
    if (error) throw new Error(error.message);

    // On referme l'affectation ouverte : sans fin_at, le chronomètre
    // continuerait de tourner dans le vide.
    await sb
      .from("affectations_etape")
      .update({ fin_at: new Date().toISOString() })
      .eq("step_id", step.id)
      .eq("worker_id", droit.profil.id)
      .is("fin_at", null);

    revalider();
    return { ok: true, message: `« ${step.step_name} » remise dans la file de l'atelier.` };
  } catch (e: any) {
    return { ok: false, message: e?.message ?? String(e) };
  }
}

// ═══════════════════════════════════════════════════════════
// OUTILS
// ═══════════════════════════════════════════════════════════

const nombre = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
};

/**
 * Ramène n'importe quelle réponse à un tableau.
 *
 * ── Pourquoi ce garde-fou existe ──
 * PostgREST rend un TABLEAU pour un `.select()`, mais une enveloppe
 * `{ data, error }` quand on oublie de déstructurer, une chaîne quand
 * la requête part en erreur, et `undefined` quand la ligne n'existe
 * pas. Un seul de ces cas suffisait à faire tomber tout le portail sur
 * `(x ?? []).map is not a function` — l'ouvrier voyait une page
 * d'erreur au lieu de son travail, à cause d'une jointure d'affichage
 * secondaire.
 *
 * Un écran d'atelier ne doit jamais s'effondrer pour une décoration.
 * Ce qui manque s'affiche vide ; ce qui compte reste debout.
 */
const lignes = (v: unknown): any[] => (Array.isArray(v) ? v : []);

const arrondi = (n: number) => Math.round(n * 100) / 100;

/**
 * Rafraîchit les écrans concernés après un geste de l'ouvrier.
 *
 * ── Pourquoi TOUS les ateliers, et pas seulement le sien ──
 * Les cinq portails ne sont pas cinq îlots : c'est une seule chaîne.
 * Une pièce finie à l'Atelier 1 (tôle) devient immédiatement du
 * travail pour l'Atelier 3 (poudrage), et une pièce poudrée devient
 * du travail pour l'Atelier 2 (bureau). Ne rafraîchir que l'atelier
 * qui vient de déclarer laisserait l'aval afficher une file où la
 * pièce n'apparaît pas encore — le contremaître appellerait pour
 * signaler une « pièce perdue » qui est en réalité devant lui.
 *
 * Cinq `revalidatePath` coûtent quelques microsecondes et évitent
 * cette conversation-là. On rafraîchit large.
 */
function revalider() {
  // Les cinq portails d'atelier — l'amont comme l'aval.
  for (const f of FICHES_ATELIERS) revalidatePath(urlAtelier(f.id));

  // Le hall et les deux portes d'entrée.
  //
  // Le scan (`/atelier/<slug>/scan`) n'est pas listé : il est monté en
  // `force-dynamic` et relit la base à chaque requête, donc il n'a pas
  // de cache à invalider. L'ajouter ici donnerait l'illusion d'un
  // rafraîchissement qui n'a jamais lieu.
  revalidatePath("/atelier");
  revalidatePath("/portail");

  // Le pilotage : ce que le chef regarde pendant que l'ouvrier déclare.
  revalidatePath("/admin");
  revalidatePath("/admin/fabrication");
  revalidatePath("/admin/suivi-atelier1");
  revalidatePath("/admin/suivi-mobilix");
  revalidatePath("/admin/ouvriers");
}
