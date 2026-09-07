"use server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceSupabase } from "@/lib/supabase/service";
import { revalidatePath } from "next/cache";

// ─── ORDERS ──────────────────────────────────────────
export async function createOrder(input: {
  orderNumber: string; dueAt?: string;
  items: { productName: string; categoryId: string; quantity: number; dimensions?: any; designNotes?: string }[];
}) {
  const supabase = createServerSupabase();
  const { data: order, error } = await supabase.from("work_orders").insert({
    order_number: input.orderNumber, due_at: input.dueAt || null, status: "CREATED"
  }).select().single();
  if (error) throw new Error(error.message);

  for (const item of input.items) {
    const { data: inserted, error: e2 } = await supabase.from("work_order_items").insert({
      order_id: order.id, product_name: item.productName, category_id: item.categoryId,
      quantity: item.quantity, dimensions: item.dimensions ?? {}, design_notes: item.designNotes ?? ""
    }).select().single();
    if (e2) throw new Error(e2.message);

    // Instance steps from template
    const { data: templates } = await supabase.from("process_templates").select("*")
      .eq("category_id", item.categoryId).order("step_order");
    if (templates && templates.length > 0) {
      const steps = templates.map((t: any) => ({
        item_id: inserted.id, step_order: t.step_order, atelier_id: t.atelier_id,
        step_name: t.step_name, estimated_minutes: t.estimated_minutes,
        has_branch: t.has_branch, status: "PENDING"
      }));
      await supabase.from("work_order_steps").insert(steps);
    }

    // Reserve materials (accumulate per stock item — one row each, avoids UNIQUE violations)
    if (templates) {
      const need = new Map<string, number>();
      const collect = (mats: any) => {
        for (const m of (mats ?? []) as any[]) {
          if (!m?.material || !m?.qty) continue;
          need.set(m.material, +((need.get(m.material) ?? 0) + m.qty * item.quantity).toFixed(3));
        }
      };
      for (const t of templates) {
        collect(t.standard_materials);
        if (t.has_branch) collect(t.branch_insert_materials);
      }
      for (const [material, totalQty] of Array.from(need.entries())) {
        const { data: stock } = await supabase.from("stock_items").select("id").ilike("name", material).single();
        if (stock) {
          await supabase.from("order_item_reservations").upsert(
            { order_item_id: inserted.id, stock_item_id: stock.id, estimated_qty: totalQty },
            { onConflict: "order_item_id,stock_item_id" }
          );
        }
      }
    }
  }
  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  return order;
}

// ─── WORKER: START STEP ──────────────────────────────
export async function startStep(stepId: string, _workerId: string) {
  // Note: kiosk workerId is a random session UUID, not a profiles.id — don't persist it
  // (would violate the worker_id FK). The floor tablet identity stays client-side.
  const supabase = createServerSupabase();
  const { error } = await supabase.from("work_order_steps").update({
    status: "ACTIVE", started_at: new Date().toISOString()
  }).eq("id", stepId);
  if (error) throw new Error(error.message);
  revalidatePath("/portal");
}

// ─── WORKER: COMPLETE STEP (with material log) ───────
export async function completeStep(input: {
  stepId: string; branchChoice?: "direct" | "indirect";
  materials: { stockItemId: string; quantityUsed: number; quantityLost: number }[];
  nextStepName?: string; nextStepMinutes?: number; nextStepMaterials?: any[];
}) {
  const supabase = createServerSupabase();
  const now = new Date().toISOString();

  // Get current step
  const { data: step } = await supabase.from("work_order_steps").select("*, work_order_items(*)").eq("id", input.stepId).single();
  if (!step) throw new Error("Step not found");

  // Complete the step
  const { error } = await supabase.from("work_order_steps").update({
    status: "DONE", completed_at: now, branch_choice: input.branchChoice ?? null
  }).eq("id", input.stepId);
  if (error) throw new Error(error.message);

  // Insert branch step if indirect
  if (input.branchChoice === "indirect" && input.nextStepName) {
    const branchOrder = +(step.step_order + 0.1).toFixed(1);
    const { data: newStep, error: e2 } = await supabase.from("work_order_steps").insert({
      item_id: step.item_id, step_order: branchOrder, atelier_id: step.atelier_id,
      step_name: `↳ ${input.nextStepName}`, status: "PENDING",
      estimated_minutes: input.nextStepMinutes ?? 20
    }).select().single();
    if (e2) throw new Error(e2.message);
  }

  // Log materials
  for (const m of input.materials) {
    if (m.quantityUsed > 0 || m.quantityLost > 0) {
      await supabase.from("material_logs").insert({
        step_id: input.stepId, stock_item_id: m.stockItemId,
        quantity_used: m.quantityUsed, quantity_lost: m.quantityLost
      });
      // Consume from stock
      const totalUsed = m.quantityUsed + m.quantityLost;
      const { data: cur } = await supabase.from("stock_items").select("quantity").eq("id", m.stockItemId).single();
      await supabase.from("stock_items").update({
        quantity: Math.max(0, Number(cur?.quantity ?? 0) - totalUsed)
      }).eq("id", m.stockItemId);
      // Mark reserved quantity as consumed so "available" stays correct
      const { data: res } = await supabase.from("order_item_reservations").select("id,consumed_qty").eq("order_item_id", step.item_id).eq("stock_item_id", m.stockItemId).maybeSingle();
      if (res) {
        await supabase.from("order_item_reservations").update({ consumed_qty: Number(res.consumed_qty ?? 0) + totalUsed }).eq("id", res.id);
      }
      // Log movement
      await supabase.from("stock_movements").insert({
        stock_item_id: m.stockItemId, step_id: input.stepId,
        order_item_id: step.item_id, movement_type: "consume", quantity: totalUsed,
        note: `Étape: ${step.step_name}`
      });
    }
  }
  revalidatePath("/portal");
  revalidatePath("/admin");
  revalidatePath("/admin/stocks");
}

// ─── ADMIN: RELEASE TO MOBILIX ───────────────────────
export async function releaseToMobilix(orderId: string) {
  const supabase = createServerSupabase();
  const { data: items } = await supabase.from("work_order_items").select("*")
    .eq("order_id", orderId).eq("status", "SEMI_READY");
  if (!items || items.length === 0) throw new Error("No ready items to release");

  for (const item of items) {
    await supabase.from("work_order_items").update({ status: "RELEASED" }).eq("id", item.id);
    await supabase.from("semi_finished_stock").update({
      status: "RELEASED", released_at: new Date().toISOString()
    }).eq("item_id", item.id).eq("status", "PENDING");
  }

  const manifest = "MNF-" + Math.random().toString(36).slice(2, 8).toUpperCase();
  await supabase.from("site_transfers").insert({
    order_id: orderId, manifest_qr: manifest, item_count: items.length, status: "PENDING"
  });

  const allReleased = (await supabase.from("work_order_items").select("id")
    .eq("order_id", orderId).neq("status", "RELEASED")).data;
  if (!allReleased || allReleased.length === 0) {
    await supabase.from("work_orders").update({ status: "RELEASED" }).eq("id", orderId);
  }
  revalidatePath("/admin");
  revalidatePath("/admin/stocks");
}

// ─── ADMIN: ADJUST STOCK ─────────────────────────────
export async function adjustStock(stockItemId: string, newQuantity: number, note?: string) {
  const supabase = createServerSupabase();
  const { data: current } = await supabase.from("stock_items").select("quantity").eq("id", stockItemId).single();
  if (!current) throw new Error("Stock item not found");
  const diff = newQuantity - current.quantity;
  await supabase.from("stock_items").update({ quantity: newQuantity }).eq("id", stockItemId);
  await supabase.from("stock_movements").insert({
    stock_item_id: stockItemId, movement_type: "adjust", quantity: Math.abs(diff),
    note: note ?? `Ajustement: ${current.quantity} → ${newQuantity}`
  });
  revalidatePath("/admin/stocks");
}

// ─── ADMIN: ADD STOCK ITEM ───────────────────────────
export async function addStockItem(name: string, unit: string, quantity: number, alertThreshold: number) {
  const supabase = createServerSupabase();
  const { error } = await supabase.from("stock_items").insert({ name, unit, quantity, alert_threshold: alertThreshold });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/stocks");
}

// ─── ADMIN: DELETE STOCK ITEM ────────────────────────
export async function deleteStockItem(id: string) {
  const supabase = createServerSupabase();
  const { error } = await supabase.from("stock_items").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/stocks");
}

// ─── TEAM (service-role: auth.admin + profiles bypass RLS safely server-side) ──
export async function inviteMember(input: { email: string; fullName: string; role: "ADMIN" | "WORKER"; atelierId: number | null }) {
  const admin = createServiceSupabase();
  const { data, error } = await admin.auth.admin.createUser({
    email: input.email, email_confirm: true,
    user_metadata: { full_name: input.fullName, role: input.role }
  });
  if (error) throw new Error(error.message);
  const userId = data.user?.id;
  if (!userId) throw new Error("No user id returned");
  const { error: e2 } = await admin.from("profiles").insert({ id: userId, role: input.role, full_name: input.fullName, atelier_id: input.atelierId });
  if (e2) throw new Error(e2.message);
  revalidatePath("/admin/team");
  return { id: userId };
}

export async function updateMember(input: { id: string; fullName: string; role: "ADMIN" | "WORKER"; atelierId: number | null }) {
  const admin = createServiceSupabase();
  const { error } = await admin.from("profiles").update({ full_name: input.fullName, role: input.role, atelier_id: input.atelierId }).eq("id", input.id);
  if (error) throw new Error(error.message);
  await admin.auth.admin.updateUserById(input.id, { user_metadata: { full_name: input.fullName, role: input.role } });
  revalidatePath("/admin/team");
}

export async function removeMember(id: string) {
  const admin = createServiceSupabase();
  await admin.from("profiles").delete().eq("id", id);
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/team");
}

// ─── LEGACY SHIMS (old UI still imports these — keep build green) ──
export async function createWorkOrder(input: { orderNumber: string; categoryId: string; targetQuantity: number; dueAt?: string }) {
  return createOrder({
    orderNumber: input.orderNumber, dueAt: input.dueAt,
    items: [{ productName: input.orderNumber, categoryId: input.categoryId, quantity: input.targetQuantity }]
  });
}

export async function createTransfer(orderId: string, _fromAtelier: number, _toAtelier: number, _count: number) {
  return releaseToMobilix(orderId);
}

export async function verifyTransfer(transferId: string, ok: boolean) {
  const supabase = createServerSupabase();
  await supabase.from("site_transfers").update({
    status: ok ? "VERIFIED" : "PENDING", verified_at: ok ? new Date().toISOString() : null
  }).eq("id", transferId);
  revalidatePath("/admin/roadmap");
}

export async function splitBatch(_stepId: string, _damaged: number) {
  // Batch splitting retired in the per-item rebuild — no-op kept for old worker UI.
  return { ok: true };
}

// ─── TEMPLATES ───────────────────────────────────────
export async function cloneTemplate(categoryId: string, fromCategoryId: string) {
  const supabase = createServerSupabase();
  const { data: rows } = await supabase.from("process_templates").select("*").eq("category_id", fromCategoryId).order("step_order");
  if (!rows) return;
  const payload = rows.map((r: any) => ({
    category_id: categoryId, step_order: r.step_order, atelier_id: r.atelier_id,
    step_name: r.step_name, estimated_minutes: r.estimated_minutes,
    standard_materials: r.standard_materials, has_branch: r.has_branch,
    branch_insert_name: r.branch_insert_name, branch_insert_materials: r.branch_insert_materials,
    branch_insert_minutes: r.branch_insert_minutes
  }));
  await supabase.from("process_templates").upsert(payload, { onConflict: "category_id,step_order" });
  revalidatePath("/admin/templates");
}

export async function saveTemplateStep(step: any) {
  const supabase = createServerSupabase();
  if (step.id) {
    const { id, ...rest } = step;
    await supabase.from("process_templates").update(rest).eq("id", id);
  } else {
    await supabase.from("process_templates").insert(step);
  }
  revalidatePath("/admin/templates");
}
