"use server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceSupabase } from "@/lib/supabase/service";
import { revalidatePath } from "next/cache";

export async function createWorkOrder(form: { orderNumber: string; categoryId: string; targetQuantity: number; dueAt?: string }) {
  const supabase = createServerSupabase();
  const { data: order, error } = await supabase.from("work_orders").insert({
    order_number: form.orderNumber, category_id: form.categoryId,
    target_quantity: form.targetQuantity, due_at: form.dueAt || null, status: "IN_PROGRESS"
  }).select().single();
  if (error) throw new Error(error.message);
  const { error: e2 } = await supabase.rpc("instantiate_work_order", { p_order: order.id });
  if (e2) throw new Error(e2.message);
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  return order;
}

export async function cloneTemplate(categoryId: string, fromCategoryId: string) {
  const supabase = createServerSupabase();
  const { data: rows, error } = await supabase.from("process_templates").select("*").eq("category_id", fromCategoryId).order("step_order");
  if (error) throw new Error(error.message);
  const payload = rows.map((r: any) => ({
    category_id: categoryId, step_order: r.step_order, atelier_id: r.atelier_id,
    step_name: r.step_name, estimated_minutes: r.estimated_minutes,
    standard_material: r.standard_material, standard_qty: r.standard_qty
  }));
  const { error: e2 } = await supabase.from("process_templates").upsert(payload, { onConflict: "category_id,step_order" });
  if (e2) throw new Error(e2.message);
  revalidatePath("/templates");
}

export async function saveTemplateStep(step: {
  id?: string; category_id: string; step_order: number; atelier_id: number;
  step_name: string; estimated_minutes: number; standard_material?: string; standard_qty?: number;
}) {
  const supabase = createServerSupabase();
  if (step.id) {
    const { error } = await supabase.from("process_templates").update({ ...step, id: undefined }).eq("id", step.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("process_templates").insert(step);
    if (error) throw new Error(error.message);
  }
  revalidatePath("/templates");
}

export async function createTransfer(orderId: string, fromAtelier: number, toAtelier: number, itemCount: number) {
  const supabase = createServerSupabase();
  const manifest = "MNF-" + Math.random().toString(36).slice(2, 8).toUpperCase();
  const { data, error } = await supabase.from("site_transfers").insert({
    work_order_id: orderId, from_atelier: fromAtelier, to_atelier: toAtelier, item_count: itemCount, manifest_qr: manifest
  }).select().single();
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
  return data;
}

export async function verifyTransfer(transferId: string, ok: boolean) {
  const supabase = createServerSupabase();
  const { error } = await supabase.from("site_transfers").update({
    status: ok ? "VERIFIED" : "SHORTAGE", verified_at: new Date().toISOString()
  }).eq("id", transferId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function splitBatch(stepId: string, damagedUnits: number) {
  const supabase = createServerSupabase();
  const { data: step, error } = await supabase.from("work_order_steps").select("*").eq("id", stepId).single();
  if (error || !step) throw new Error("Step not found");
  const good = Math.max(0, (step.expected_units ?? 0) - damagedUnits);
  const { error: e2 } = await supabase.from("work_order_steps").update({
    status: "DONE", good_units: good, scrap_units: damagedUnits, completed_at: new Date().toISOString()
  }).eq("id", stepId);
  if (e2) throw new Error(e2.message);
  await supabase.from("work_order_steps").insert({
    work_order_id: step.work_order_id, step_order: step.step_order + 0.5,
    atelier_id: step.atelier_id, step_name: `${step.step_name} — REWORK (${damagedUnits})`,
    status: "REWORK", estimated_minutes: step.estimated_minutes,
    expected_units: damagedUnits
  });
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

// ---------------- Team management (ADMIN, service-role) ----------------

export async function inviteMember(input: { email: string; fullName: string; role: "ADMIN" | "WORKER"; atelierId: number | null }) {
  const service = createServiceSupabase();
  const { data, error } = await service.auth.admin.createUser({
    email: input.email,
    email_confirm: true,
    user_metadata: { full_name: input.fullName, role: input.role }
  });
  if (error) throw new Error(error.message);
  const userId = data.user?.id;
  if (!userId) throw new Error("User creation returned no id.");
  const { error: e2 } = await service.from("profiles").insert({
    id: userId, role: input.role, full_name: input.fullName, atelier_id: input.atelierId
  });
  if (e2) throw new Error(e2.message);
  revalidatePath("/admin/team");
  return { id: userId };
}

export async function updateMember(input: { id: string; fullName: string; role: "ADMIN" | "WORKER"; atelierId: number | null }) {
  const service = createServiceSupabase();
  const { error } = await service.from("profiles").update({
    full_name: input.fullName, role: input.role, atelier_id: input.atelierId
  }).eq("id", input.id);
  if (error) throw new Error(error.message);
  await service.auth.admin.updateUserById(input.id, { user_metadata: { full_name: input.fullName, role: input.role } });
  revalidatePath("/admin/team");
}

export async function removeMember(id: string) {
  const service = createServiceSupabase();
  const { error } = await service.auth.admin.deleteUser(id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/team");
}
