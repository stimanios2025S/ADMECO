import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const { manifest } = await req.json();
  const code = String(manifest ?? "").replace("MES:MNF:", "").trim();
  const supabase = createServerSupabase();
  const { data, error } = await supabase.from("site_transfers").select("*, work_orders(order_number)").eq("manifest_qr", code).single();
  if (error || !data) return NextResponse.json({ ok: false, error: "Manifest not found" }, { status: 404 });
  return NextResponse.json({ ok: true, transfer: data });
}
