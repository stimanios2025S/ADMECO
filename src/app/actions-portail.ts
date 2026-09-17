"use server";
import { createServerSupabase } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Déclaration de production d'un ouvrier (QR scanné, étape ACTIVE → DONE).
 * Enregistre : quantité produite OK, perdue, réutilisée + consommation MP.
 * - `quantity_ok` sur l'étape et les material_logs (archive par commande/usine).
 * - Déduction progressive des réserves (`consumed_qty`) créées à la commande.
 * - Alerte STOCK si un stock passe sous son seuil après déduction.
 * Tolérant aux migrations absentes (try/catch sur chaque écriture optionnelle).
 */

export type DeclarationMP = {
  stockItemId: string;
  quantityUsed: number;
  quantityLost: number;
};

export type DeclarerProductionInput = {
  stepId: string;
  quantiteOk: number;
  quantitePerdue?: number;
  quantiteReutilisee?: number;
  branchChoice?: "direct" | "indirect";
  materials?: DeclarationMP[];
  nextStepName?: string;
  nextStepMinutes?: number;
};

const num = (v: unknown): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

export async function declarerProduction(
  input: DeclarerProductionInput
): Promise<{ ok: boolean; message: string }> {
  try {
    if (!input?.stepId) return { ok: false, message: "Étape manquante." };
    const supabase: any = createServerSupabase();
    const now = new Date().toISOString();
    const ok = num(input.quantiteOk);
    const perdu = num(input.quantitePerdue);
    const reutilise = num(input.quantiteReutilisee);

    const { data: step, error: eStep } = await supabase
      .from("work_order_steps")
      .select("*, work_order_items(id,product_name,order_id,work_orders(order_number,usine_code))")
      .eq("id", input.stepId)
      .maybeSingle();
    if (eStep || !step) return { ok: false, message: "Étape introuvable." };

    const itemId = (step as any).item_id;
    const usine: string =
      (step as any)?.work_order_items?.work_orders?.usine_code ?? "ADMEDCO";
    const nomArticle: string =
      (step as any)?.work_order_items?.product_name ??
      (step as any)?.step_name ??
      "Article";

    // 1. Étape → DONE + quantités déclarées (+ branche éventuelle)
    try {
      const { error } = await supabase
        .from("work_order_steps")
        .update({
          status: "DONE",
          completed_at: now,
          quantity_ok: ok,
          branch_choice: input.branchChoice ?? null,
        })
        .eq("id", input.stepId);
      if (error) throw error;
    } catch (e: any) {
      // Colonne quantity_ok absente (migration 0012 non jouée) → repli sans elle
      if (!/quantity_ok|column/i.test(e?.message ?? "")) throw new Error(e?.message ?? e);
      const { error } = await supabase
        .from("work_order_steps")
        .update({
          status: "DONE",
          completed_at: now,
          branch_choice: input.branchChoice ?? null,
        })
        .eq("id", input.stepId);
      if (error) throw new Error(error.message);
    }

    if (input.branchChoice === "indirect" && input.nextStepName) {
      try {
        const ordreBranche = +(Number((step as any).step_order) + 0.1).toFixed(1);
        await supabase.from("work_order_steps").insert({
          item_id: itemId,
          step_order: ordreBranche,
          atelier_id: (step as any).atelier_id,
          step_name: `↳ ${input.nextStepName}`,
          status: "PENDING",
          estimated_minutes: input.nextStepMinutes ?? 20,
        });
      } catch {
        /* branche optionnelle */
      }
    }

    // 2. Consommation MP : material_logs + déduction stock + réserves
    const mats = (input.materials ?? []).filter(
      (m) => num(m.quantityUsed) > 0 || num(m.quantityLost) > 0
    );
    for (const m of mats) {
      const utilise = num(m.quantityUsed);
      const casse = num(m.quantityLost);
      const total = +(utilise + casse).toFixed(3);

      // 2a. Log matière (avec quantité OK déclarée sur la première ligne)
      try {
        await supabase.from("material_logs").insert({
          step_id: input.stepId,
          stock_item_id: m.stockItemId,
          quantity_used: utilise,
          quantity_lost: casse,
          quantity_ok: ok,
        });
      } catch (e: any) {
        if (!/quantity_ok|column/i.test(e?.message ?? "")) {
          const { error } = await supabase.from("material_logs").insert({
            step_id: input.stepId,
            stock_item_id: m.stockItemId,
            quantity_used: utilise,
            quantity_lost: casse,
          });
          if (error) throw new Error(error.message);
        }
      }

      // 2b. Déduction du stock physique
      let stockNom = "Matière";
      let stockUnit = "";
      let stockRestant = 0;
      let seuil = 0;
      try {
        const { data: cur } = await supabase
          .from("stock_items")
          .select("id,name,unit,quantity,alert_threshold")
          .eq("id", m.stockItemId)
          .maybeSingle();
        if (cur) {
          stockNom = (cur as any).name ?? stockNom;
          stockUnit = (cur as any).unit ?? "";
          stockRestant = Math.max(0, num((cur as any).quantity) - total);
          seuil = num((cur as any).alert_threshold);
          await supabase
            .from("stock_items")
            .update({ quantity: stockRestant })
            .eq("id", m.stockItemId);
        }
      } catch {
        /* stock introuvable — on continue */
      }

      // 2c. Déduction progressive de la réserve (jamais de blocage)
      try {
        const { data: res } = await supabase
          .from("order_item_reservations")
          .select("id,consumed_qty")
          .eq("order_item_id", itemId)
          .eq("stock_item_id", m.stockItemId)
          .maybeSingle();
        if (res) {
          await supabase
            .from("order_item_reservations")
            .update({ consumed_qty: num((res as any).consumed_qty) + total })
            .eq("id", (res as any).id);
        }
      } catch {
        /* réserves optionnelles */
      }

      // 2d. Événement CONSUME (journal des réserves)
      try {
        await supabase.from("reservation_events").insert({
          order_item_id: itemId,
          stock_item_id: m.stockItemId,
          type: "CONSUME",
          qty: total,
          note: `Déclaré sur « ${nomArticle} » : utilisé ${utilise}, perdu ${casse}`,
        });
      } catch {
        /* table optionnelle */
      }

      // 2e. Mouvement de traçabilité (repli sans depot_code si ancien schéma)
      try {
        const payload: any = {
          stock_item_id: m.stockItemId,
          step_id: input.stepId,
          order_item_id: itemId,
          movement_type: "consume",
          quantity: total,
          depot_code: "DEP-MP",
          note: `Étape : ${(step as any).step_name} (déclaration ouvrier)`,
        };
        const mv = await supabase.from("stock_movements").insert(payload);
        if (mv.error && /depot_code|column|schema/i.test(mv.error.message ?? "")) {
          const { depot_code: _drop, ...legacy } = payload;
          const retry = await supabase.from("stock_movements").insert(legacy);
          if (retry.error) throw new Error(retry.error.message);
        } else if (mv.error) {
          throw new Error(mv.error.message);
        }
      } catch {
        /* mouvements optionnels */
      }

      // 2f. Alerte STOCK si sous le seuil (jamais de blocage)
      if (seuil > 0 && stockRestant < seuil) {
        try {
          await supabase.from("alertes").insert({
            usine_code: usine,
            type: "STOCK",
            message: `Stock bas : ${stockNom} — reste ${stockRestant} ${stockUnit} (seuil ${seuil}). Commande « ${nomArticle} ».`,
            lu: false,
          });
        } catch {
          /* alertes optionnelles */
        }
      }
    }

    revalidatePath("/portal");
    revalidatePath("/admin");
    revalidatePath("/admin/stocks");
    revalidatePath("/admin/archives");

    const resume =
      `Étape « ${(step as any).step_name} » terminée : ` +
      `${ok} produite(s)` +
      (perdu > 0 ? `, ${perdu} perdue(s)` : "") +
      (reutilise > 0 ? `, ${reutilise} réutilisée(s)` : "") +
      (mats.length > 0 ? `, ${mats.length} matière(s) déduite(s).` : ".");
    return { ok: true, message: resume };
  } catch (e: any) {
    return { ok: false, message: `Échec de la déclaration : ${e?.message ?? e}` };
  }
}
