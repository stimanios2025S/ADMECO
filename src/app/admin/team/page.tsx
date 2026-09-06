import { createServerSupabase } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/AdminShell";
import TeamClient from "./TeamClient";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const supabase = createServerSupabase();
  const [{ data: members }, { data: steps }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at", { ascending: false }),
    supabase.from("work_order_steps").select("worker_id,status,actual_minutes,estimated_minutes").not("worker_id", "is", null).limit(2000)
  ]);

  const perWorker = new Map<string, { active: number; done: number }>();
  for (const s of steps ?? []) {
    const w = (s as any).worker_id as string;
    const cur = perWorker.get(w) ?? { active: 0, done: 0 };
    if ((s as any).status === "DONE") cur.done += 1;
    else cur.active += 1;
    perWorker.set(w, cur);
  }

  return (
    <AdminShell pageTitle="Team" pageHint="Workers, ateliers and roles — invite, assign, manage.">
      <TeamClient members={(members ?? []).map((m: any) => ({ ...m, stats: perWorker.get(m.id) ?? { active: 0, done: 0 } }))} />
    </AdminShell>
  );
}
