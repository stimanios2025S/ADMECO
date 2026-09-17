"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { getProfil, depotMP } from "@/lib/auth";
import { calculBesoinMP, messageEmprunt } from "@/lib/agents/reservation";
import { parserFactureTexte, classerFamille } from "@/lib/agents/reception";
import { ETAPES_MOBILIX, type ModeleMobilix } from "@/lib/process-mobilix";

const rnd = (n = 6) => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";
  let s = "";
  for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
};

function errFr(prefix: string, e: any): string {
  const m = e?.message ?? String(e);
  if (/relation|column|table|schema|does not exist|migration/i.test(m))
    return `${prefix} : table ou colonne manquante (${m}) — l'autre équipe doit exécuter la migration.`;
  return `${prefix} : ${m}`;
}

// ─── 1. Décider la destination d'un lot semi-fini ─────────────────────────────
export async function deciderDestination(input: {
  semiStockId?: string;
  orderItemId?: string;
  destination: "MOBILIX" | "CLIENT_DIRECT";
}): Promise<{ ok: boolean; message: string; bordereau?: string }> {
  try {
    const profil = await getProfil();
    const supabase: any = createServerSupabase();
    if (!input.semiStockId && !input.orderItemId)
      return { ok: false, message: "Lot ou article manquant pour décider la destination." };

    const bordereau = `DST-${rnd(6)}`;

    // Résoudre order_id / usine pour le transfert éventuel
    let orderId: string | null = null;
    let usineCode: string = (profil as any)?.usine_code ?? "ADMEDCO";
    try {
      if (input.orderItemId) {
        const { data: it } = await supabase
          .from("work_order_items")
          .select("id,order_id,work_orders(usine_code)")
          .eq("id", input.orderItemId)
          .maybeSingle();
        if (it?.order_id) orderId = it.order_id as string;
        const u = (it as any)?.work_orders?.usine_code;
        if (u) usineCode = u;
      } else if (input.semiStockId) {
        const { data: semi } = await supabase
          .from("semi_finished_stock")
          .select("id,item_id,work_order_items(order_id,work_orders(usine_code))")
          .eq("id", input.semiStockId)
          .maybeSingle();
        const wi = (semi as any)?.work_order_items;
        if (wi?.order_id) orderId = wi.order_id as string;
        if (wi?.work_orders?.usine_code) usineCode = wi.work_orders.usine_code as string;
      }
    } catch {
      /* jointures optionnelles — on continue */
    }

    const { error: eIns } = await supabase.from("destinations").insert({
      semi_stock_id: input.semiStockId ?? null,
      order_item_id: input.orderItemId ?? null,
      destination: input.destination,
      bordereau,
      statut: "DECIDE"
    });
    if (eIns) throw new Error(eIns.message);

    if (input.destination === "MOBILIX") {
      try {
        await supabase.from("site_transfers").insert({
          order_id: orderId,
          order_item_id: input.orderItemId ?? null,
          semi_stock_id: input.semiStockId ?? null,
          destination: "MOBILIX",
          usine_code: usineCode,
          manifest_qr: bordereau,
          status: "PENDING"
        });
      } catch (e2: any) {
        // La destination reste enregistrée même si le transfert échoue
        revalidatePath("/admin/destinations");
        return {
          ok: true,
          bordereau,
          message: `Destination MOBILIX enregistrée (${bordereau}). Transfert à créer manuellement : ${e2?.message ?? e2}`
        };
      }
    }

    // Marquer le lot comme décidé si possible (colonne statut)
    try {
      if (input.semiStockId) {
        await supabase.from("semi_finished_stock").update({ status: "DECIDED" }).eq("id", input.semiStockId);
      }
    } catch {
      /* colonne/statut optionnel */
    }

    revalidatePath("/admin/destinations");
    revalidatePath("/admin/roadmap");
    revalidatePath("/admin");
    return {
      ok: true,
      bordereau,
      message:
        input.destination === "MOBILIX"
          ? `Lot envoyé vers MOBILIX — bordereau ${bordereau}.`
          : `Lot en livraison client direct — bordereau ${bordereau}.`
    };
  } catch (e: any) {
    return { ok: false, message: errFr("Échec de la décision destination", e) };
  }
}

// ─── 2. Proposer une réception MP depuis un texte de facture ──────────────────
export async function proposerReceptionMP(
  usineCode: string,
  texteFacture: string
): Promise<{ ok: boolean; message: string; receptionId?: string; fournisseurNom?: string; lignes?: any[] }> {
  try {
    if (!texteFacture?.trim()) return { ok: false, message: "Collez le texte de la facture avant d'analyser." };
    const parsed = parserFactureTexte(texteFacture);
    if (!parsed.lignes || parsed.lignes.length === 0)
      return { ok: false, message: "Aucune ligne détectée — vérifiez le format (désignation;quantité;prix)." };

    const profil = await getProfil();
    const supabase: any = createServerSupabase();
    const usine = usineCode || (profil as any)?.usine_code || "ADMEDCO";

    // Upsert fournisseur par nom + usine
    let fournisseurId: string | null = null;
    try {
      const { data: existing } = await supabase
        .from("fournisseurs")
        .select("id")
        .eq("usine_code", usine)
        .ilike("nom", parsed.fournisseurNom)
        .maybeSingle();
      if (existing?.id) fournisseurId = existing.id as string;
    } catch {
      /* table absente → on tente l'insert direct */
    }
    if (!fournisseurId) {
      const { data: created, error: eF } = await supabase
        .from("fournisseurs")
        .insert({ usine_code: usine, nom: parsed.fournisseurNom })
        .select("id")
        .maybeSingle();
      if (eF) throw new Error(eF.message);
      fournisseurId = (created as any)?.id ?? null;
    }

    const lignes = parsed.lignes.map((l: any) => ({
      designation: l.designation,
      quantite: Number(l.quantite) || 0,
      prixUnitaire: Number(l.prixUnitaire) || 0,
      famille: l.famille ?? classerFamille(l.designation)
    }));

    const { data: rec, error: eR } = await supabase
      .from("receptions_mp")
      .insert({
        usine_code: usine,
        fournisseur_id: fournisseurId,
        numero_facture: parsed.numeroFacture || null,
        lignes,
        statut: "PROPOSEE",
        created_by: (profil as any)?.id ?? null
      })
      .select("id")
      .maybeSingle();
    if (eR) throw new Error(eR.message);

    revalidatePath("/admin/reception");
    return {
      ok: true,
      message: `Facture analysée : ${lignes.length} ligne(s) de « ${parsed.fournisseurNom} ». Vérifiez puis confirmez.`,
      receptionId: (rec as any)?.id as string,
      fournisseurNom: parsed.fournisseurNom,
      lignes
    };
  } catch (e: any) {
    return { ok: false, message: errFr("Échec de l'analyse de la facture", e) };
  }
}

// ─── 3. Confirmer une réception MP → entrée en stock ──────────────────────────
export async function confirmerReceptionMP(
  receptionId: string,
  lignesCorrigees: any[]
): Promise<{ ok: boolean; message: string }> {
  try {
    if (!receptionId) return { ok: false, message: "Réception introuvable." };
    if (!lignesCorrigees || lignesCorrigees.length === 0)
      return { ok: false, message: "Aucune ligne à confirmer." };

    const supabase: any = createServerSupabase();
    const { data: rec, error: eGet } = await supabase
      .from("receptions_mp")
      .select("id,usine_code,statut")
      .eq("id", receptionId)
      .maybeSingle();
    if (eGet) throw new Error(eGet.message);
    if (!rec) return { ok: false, message: "Réception introuvable." };
    const usine = (rec as any).usine_code ?? "ADMEDCO";
    const depot = depotMP(usine);

    const lignes = (lignesCorrigees ?? [])
      .map((l: any) => ({
        designation: String(l.designation ?? "").trim(),
        quantite: Number(l.quantite) || 0,
        prixUnitaire: Number(l.prixUnitaire) || 0,
        famille: l.famille ?? classerFamille(String(l.designation ?? ""))
      }))
      .filter((l: any) => l.designation && l.quantite > 0);
    if (lignes.length === 0) return { ok: false, message: "Corrigez au moins une ligne avec quantité > 0." };

    const { error: eUp } = await supabase
      .from("receptions_mp")
      .update({ lignes, statut: "CONFIRMEE" })
      .eq("id", receptionId);
    if (eUp) throw new Error(eUp.message);

    let nb = 0;
    for (const l of lignes) {
      // Upsert stock_items par nom + usine / dépôt MP
      let stockId: string | null = null;
      try {
        const { data: found } = await supabase
          .from("stock_items")
          .select("id,quantity")
          .ilike("name", l.designation)
          .eq("depot_code", depot)
          .maybeSingle();
        if ((found as any)?.id) {
          stockId = (found as any).id as string;
          const { error: eS } = await supabase
            .from("stock_items")
            .update({ quantity: Number((found as any).quantity ?? 0) + Number(l.quantite) })
            .eq("id", stockId);
          if (eS) throw new Error(eS.message);
        }
      } catch (e: any) {
        if (/Échec|missing|relation|column/i.test(e?.message ?? "")) throw e;
        stockId = null;
      }
      if (!stockId) {
        try {
          const { data: created, error: eC } = await supabase
            .from("stock_items")
            .insert({
              name: l.designation,
              unit: "pcs",
              quantity: Number(l.quantite),
              alert_threshold: 10,
              depot_code: depot,
              usine_code: usine
            })
            .select("id")
            .maybeSingle();
          if (eC) throw new Error(eC.message);
          stockId = (created as any)?.id ?? null;
        } catch (e2: any) {
          // Colonne usine_code peut manquer dans les vieux schémas → réessayer sans
          if (/usine_code|column/i.test(e2?.message ?? "")) {
            const { data: created } = await supabase
              .from("stock_items")
              .insert({
                name: l.designation,
                unit: "pcs",
                quantity: Number(l.quantite),
                alert_threshold: 10,
                depot_code: depot
              })
              .select("id")
              .maybeSingle();
            stockId = (created as any)?.id ?? null;
          } else throw e2;
        }
      }
      if (stockId) {
        try {
          await supabase.from("stock_movements").insert({
            stock_item_id: stockId,
            movement_type: "adjust",
            quantity: Number(l.quantite),
            note: `Réception ${receptionId} — ${l.designation}`
          });
        } catch {
          /* mouvements optionnels */
        }
        // Auto-insert erp_articles si table accessible
        try {
          await supabase.from("erp_articles").insert({
            name: l.designation,
            unit: "pcs",
            family: l.famille,
            purchase_price: Number(l.prixUnitaire) || 0
          });
        } catch {
          /* table ERP absente — on ignore */
        }
        nb++;
      }
    }

    revalidatePath("/admin/reception");
    revalidatePath("/admin/stocks");
    revalidatePath("/admin");
    return { ok: true, message: `Entrée en stock confirmée : ${nb} article(s) ajoutés au ${depot}.` };
  } catch (e: any) {
    return { ok: false, message: errFr("Échec de la confirmation", e) };
  }
}

// ─── 4. Créer une commande avec réservation MP ────────────────────────────────
export async function creerCommandeAvecReservation(input: {
  orderNumber: string;
  usineCode: string;
  items: { productName: string; categoryId: string; quantity: number }[];
}): Promise<{ ok: boolean; message: string; orderId?: string }> {
  try {
    if (!input.orderNumber?.trim()) return { ok: false, message: "Numéro de commande requis." };
    if (!input.items || input.items.length === 0) return { ok: false, message: "Ajoutez au moins un article." };

    const supabase: any = createServerSupabase();
    const usine = input.usineCode || "ADMEDCO";
    const depot = depotMP(usine);

    const { data: order, error: eO } = await supabase
      .from("work_orders")
      .insert({ order_number: input.orderNumber.trim(), status: "CREATED", usine_code: usine })
      .select("id")
      .maybeSingle();
    if (eO) {
      // Schéma sans usine_code → réessayer sans
      if (/usine_code|column/i.test(eO.message)) {
        const retry = await supabase
          .from("work_orders")
          .insert({ order_number: input.orderNumber.trim(), status: "CREATED" })
          .select("id")
          .maybeSingle();
        if (retry.error) throw new Error(retry.error.message);
        return await creerItemsEtReserves(supabase, (retry.data as any).id, usine, depot, input.items);
      }
      throw new Error(eO.message);
    }
    return await creerItemsEtReserves(supabase, (order as any).id as string, usine, depot, input.items);
  } catch (e: any) {
    return { ok: false, message: errFr("Échec de création commande", e) };
  }
}

async function creerItemsEtReserves(
  supabase: any,
  orderId: string,
  usine: string,
  depot: string,
  items: { productName: string; categoryId: string; quantity: number }[]
): Promise<{ ok: boolean; message: string; orderId?: string }> {
  for (const item of items) {
    const qty = Number(item.quantity) || 0;
    if (!item.productName?.trim() || !(qty > 0)) continue;
    const { data: inserted, error: eI } = await supabase
      .from("work_order_items")
      .insert({
        order_id: orderId,
        product_name: item.productName.trim(),
        category_id: item.categoryId || null,
        quantity: qty,
        status: "CREATED"
      })
      .select("id")
      .maybeSingle();
    if (eI) throw new Error(eI.message);
    const itemId = (inserted as any).id as string;

    // Étapes depuis les gammes
    let templates: any[] = [];
    try {
      const { data } = await supabase
        .from("process_templates")
        .select("*")
        .eq("category_id", item.categoryId)
        .order("step_order");
      templates = (data as any[]) ?? [];
    } catch {
      templates = [];
    }
    if (templates.length > 0) {
      const steps = templates.map((t: any) => ({
        item_id: itemId,
        step_order: t.step_order,
        atelier_id: usine === "MOBILIX" ? 3 : t.atelier_id ?? 1,
        step_name: t.step_name,
        estimated_minutes: t.estimated_minutes ?? 30,
        has_branch: t.has_branch ?? false,
        status: "PENDING"
      }));
      try {
        await supabase.from("work_order_steps").insert(steps);
      } catch {
        /* étapes optionnelles */
      }
    }

    // Besoins MP → réservations + événements RESERVE
    const besoins = calculBesoinMP(templates, qty);
    for (const b of besoins) {
      let stockId: string | null = null;
      try {
        const { data: found } = await supabase
          .from("stock_items")
          .select("id")
          .ilike("name", b.material)
          .eq("depot_code", depot)
          .maybeSingle();
        stockId = (found as any)?.id ?? null;
      } catch {
        stockId = null;
      }
      if (!stockId) {
        try {
          const { data: created } = await supabase
            .from("stock_items")
            .insert({
              name: b.material,
              unit: b.unit ?? "pcs",
              quantity: 0,
              alert_threshold: 10,
              depot_code: depot,
              usine_code: usine
            })
            .select("id")
            .maybeSingle();
          stockId = (created as any)?.id ?? null;
        } catch {
          stockId = null;
        }
      }
      if (!stockId) continue;
      try {
        await supabase.from("order_item_reservations").upsert(
          { order_item_id: itemId, stock_item_id: stockId, estimated_qty: b.qty, consumed_qty: 0 },
          { onConflict: "order_item_id,stock_item_id" }
        );
      } catch {
        await supabase
          .from("order_item_reservations")
          .insert({ order_item_id: itemId, stock_item_id: stockId, estimated_qty: b.qty, consumed_qty: 0 });
      }
      try {
        await supabase.from("reservation_events").insert({
          order_item_id: itemId,
          stock_item_id: stockId,
          type: "RESERVE",
          qty: b.qty,
          note: `Réserve ${b.material} ×${b.qty} ${b.unit ?? ""} pour ${item.productName}`
        });
      } catch {
        /* événements optionnels */
      }
    }
  }

  revalidatePath("/admin/orders");
  revalidatePath("/admin");
  revalidatePath("/admin/stocks");
  return { ok: true, message: `Commande ${items.length} article(s) créée avec réserves MP.`, orderId: orderId };
}

// ─── 5. Contrôler la disponibilité d'un article (emprunts inter-commandes) ────
export async function controlerDisponibilite(
  orderItemId: string
): Promise<{ ok: boolean; message: string; controles?: any[]; emprunts?: any[] }> {
  try {
    if (!orderItemId) return { ok: false, message: "Article manquant." };
    const profil = await getProfil();
    const usine = (profil as any)?.usine_code ?? "ADMEDCO";
    const supabase: any = createServerSupabase();

    const { data: item } = await supabase
      .from("work_order_items")
      .select("id,product_name,order_id,created_at,work_orders(order_number,usine_code)")
      .eq("id", orderItemId)
      .maybeSingle();
    const nomDst =
      (item as any)?.product_name ??
      (item as any)?.work_orders?.order_number ??
      orderItemId.slice(0, 8);

    const { data: resas } = await supabase
      .from("order_item_reservations")
      .select("id,order_item_id,stock_item_id,estimated_qty,consumed_qty,created_at,stock_items(id,name,unit,quantity)")
      .eq("order_item_id", orderItemId);
    const liste: any[] = (resas as any[]) ?? [];
    if (liste.length === 0) return { ok: true, message: "Aucune réserve à contrôler pour cet article.", controles: [], emprunts: [] };

    const controles: any[] = [];
    const emprunts: any[] = [];

    for (const r of liste) {
      const stock = (r as any).stock_items;
      const besoin = Number(r.estimated_qty ?? 0) - Number(r.consumed_qty ?? 0);
      // Déjà réservé par les AUTRES articles sur le même stock
      let autres = 0;
      try {
        const { data: all } = await supabase
          .from("order_item_reservations")
          .select("order_item_id,estimated_qty,consumed_qty")
          .eq("stock_item_id", r.stock_item_id)
          .neq("order_item_id", orderItemId);
        autres = ((all as any[]) ?? []).reduce(
          (a: number, x: any) => a + (Number(x.estimated_qty ?? 0) - Number(x.consumed_qty ?? 0)),
          0
        );
      } catch {
        autres = 0;
      }
      const dispo = Number(stock?.quantity ?? 0) - autres;
      const manque = Math.max(0, +(besoin - dispo).toFixed(3));
      const ctrl = {
        material: stock?.name ?? "Matière",
        unit: stock?.unit ?? "pcs",
        besoin,
        dispo: +dispo.toFixed(3),
        manque,
        statut: manque > 0 ? "MANQUE" : "OK"
      };
      controles.push(ctrl);

      if (manque > 0) {
        // Chercher une réserve plus ancienne non consommée sur le même stock
        let src: any = null;
        try {
          const { data: cand } = await supabase
            .from("order_item_reservations")
            .select("id,order_item_id,estimated_qty,consumed_qty,created_at,work_order_items(product_name,order_id,work_orders(order_number))")
            .eq("stock_item_id", r.stock_item_id)
            .neq("order_item_id", orderItemId)
            .order("created_at", { ascending: true })
            .limit(5);
          src =
            ((cand as any[]) ?? []).find((c: any) => Number(c.estimated_qty ?? 0) - Number(c.consumed_qty ?? 0) > 0) ??
            null;
        } catch {
          src = null;
        }
        const nomSrc =
          (src as any)?.work_order_items?.product_name ??
          (src as any)?.work_order_items?.work_orders?.order_number ??
          "une commande antérieure";
        const msg = messageEmprunt(nomSrc, nomDst, ctrl.material, manque, ctrl.unit);
        try {
          await supabase.from("reservation_events").insert({
            order_item_id: orderItemId,
            stock_item_id: r.stock_item_id,
            type: "BORROW",
            qty: manque,
            note: msg
          });
        } catch {
          /* optionnel */
        }
        try {
          await supabase.from("alertes").insert({
            usine_code: usine,
            type: "EMPRUNT",
            message: msg,
            lu: false
          });
        } catch {
          /* table alertes absente — on ignore */
        }
        emprunts.push({ material: ctrl.material, qty: manque, unit: ctrl.unit, source: nomSrc, message: msg });
      }
    }

    revalidatePath("/admin");
    revalidatePath("/admin/stocks");
    revalidatePath("/admin/incidents");
    const nbManque = controles.filter((c) => c.statut === "MANQUE").length;
    return {
      ok: true,
      message:
        nbManque === 0
          ? `Disponibilité OK : ${controles.length} matière(s) couverte(s).`
          : `${nbManque} matière(s) en manque — ${emprunts.length} emprunt(s) proposé(s), alerte envoyée.`,
      controles,
      emprunts
    };
  } catch (e: any) {
    return { ok: false, message: errFr("Échec du contrôle de disponibilité", e) };
  }
}

// ─── 6. Marquer une alerte comme lue ──────────────────────────────────────────
export async function marquerAlerteLue(alerteId: string): Promise<{ ok: boolean; message: string }> {
  try {
    const supabase: any = createServerSupabase();
    const { error } = await supabase.from("alertes").update({ lu: true }).eq("id", alerteId);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/incidents");
    revalidatePath("/admin");
    return { ok: true, message: "Alerte marquée comme lue." };
  } catch (e: any) {
    return { ok: false, message: errFr("Impossible de marquer l'alerte", e) };
  }
}

// ─── 7. Lancer le suivi MOBILIX (G21 / CANADA) — 19 QR par article ─────────────
// Crée une commande MOBILIX + 1 article par ligne + les 19 étapes M1
// (ordres 1,2,3,4, 5.1→5.8 couture A→H, 6→12). Les QR sont générés par la base.
export async function lancerSuiviMobilix(input: {
  orderNumber: string;
  modele: ModeleMobilix;
  quantity: number;
}): Promise<{ ok: boolean; message: string; orderId?: string }> {
  try {
    const modele: ModeleMobilix = input.modele === "CANADA" ? "CANADA" : "G21";
    const qty = Math.floor(Number(input.quantity) || 0);
    if (!input.orderNumber?.trim()) return { ok: false, message: "Numéro de suivi requis (ex. MBX-2026-001)." };
    if (!(qty > 0)) return { ok: false, message: "Quantité de chaises invalide." };

    const supabase: any = createServerSupabase();
    const productName = modele === "CANADA" ? "Chaise CANADA" : "Chaise G21";

    const { data: order, error: eO } = await supabase
      .from("work_orders")
      .insert({ order_number: input.orderNumber.trim(), status: "CREATED", usine_code: "MOBILIX" })
      .select("id")
      .maybeSingle();
    if (eO) {
      if (/usine_code|column/i.test(eO.message)) {
        const retry = await supabase
          .from("work_orders")
          .insert({ order_number: input.orderNumber.trim(), status: "CREATED" })
          .select("id")
          .maybeSingle();
        if (retry.error) throw new Error(retry.error.message);
        return await creerLignesMobilix(supabase, (retry.data as any).id as string, modele, productName, qty);
      }
      throw new Error(eO.message);
    }
    return await creerLignesMobilix(supabase, (order as any).id as string, modele, productName, qty);
  } catch (e: any) {
    return { ok: false, message: errFr("Échec du lancement suivi MOBILIX", e) };
  }
}

async function categorieMobilixId(supabase: any, modele: ModeleMobilix): Promise<string | null> {
  const nom = modele === "CANADA" ? "Chaise CANADA" : "Chaise G21";
  try {
    const { data } = await supabase.from("product_categories").select("id").eq("name", nom).maybeSingle();
    if ((data as any)?.id) return (data as any).id as string;
    const { data: created } = await supabase.from("product_categories").insert({ name: nom }).select("id").maybeSingle();
    return ((created as any)?.id as string) ?? null;
  } catch {
    return null;
  }
}

async function creerLignesMobilix(
  supabase: any,
  orderId: string,
  modele: ModeleMobilix,
  productName: string,
  qty: number
): Promise<{ ok: boolean; message: string; orderId?: string }> {
  const { data: inserted, error: eI } = await supabase
    .from("work_order_items")
    .insert({
      order_id: orderId,
      product_name: `${productName} ×${qty}`,
      category_id: await categorieMobilixId(supabase, modele),
      quantity: qty,
      status: "CREATED",
      design_notes: `Suivi MOBILIX — modèle ${modele} — process 12 postes / 19 QR`
    })
    .select("id")
    .maybeSingle();
  if (eI) throw new Error(eI.message);
  const itemId = (inserted as any).id as string;

  // 19 étapes M1 — noms adaptés au modèle pour les étapes 8 et 10
  const steps = ETAPES_MOBILIX.map((e) => {
    let nom = e.nom;
    if (e.code === "MBX-INSERTS")
      nom = modele === "CANADA" ? "Inserts (12 / chaise)" : "Inserts (8 / chaise)";
    if (e.code === "MBX-PIET-ACC")
      nom = modele === "CANADA" ? "Accoudoirs" : "Piètement G21";
    if (e.code === "MBX-ASSEMBLAGE")
      nom = modele === "CANADA" ? "Partie métal" : "Assemblage final";
    return {
      item_id: itemId,
      step_order: e.ordre,
      atelier_id: 3,
      step_name: nom,
      estimated_minutes: e.ordre >= 5 && e.ordre < 6 ? 15 : 30,
      has_branch: false,
      status: "PENDING"
    };
  });
  try {
    const { error: eS } = await supabase.from("work_order_steps").insert(steps);
    if (eS) throw new Error(eS.message);
  } catch (e: any) {
    throw new Error(`Étapes MOBILIX : ${e?.message ?? e}`);
  }

  // Réserve MP indicative (structure + habillage par chaise)
  try {
    await supabase.from("reservation_events").insert({
      order_item_id: itemId,
      stock_item_id: null,
      type: "RESERVE",
      qty,
      note: `Suivi MOBILIX ${modele} : ${qty} chaise(s) — 19 étapes M1`
    });
  } catch {
    /* journal optionnel */
  }

  revalidatePath("/admin/orders");
  revalidatePath("/portal");
  revalidatePath("/admin");
  return {
    ok: true,
    orderId,
    message: `Suivi MOBILIX ${modele} lancé : ${qty} chaise(s), 19 étapes M1 avec QR.`
  };
}
