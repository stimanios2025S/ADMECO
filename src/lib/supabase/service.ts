import { createClient } from "@supabase/supabase-js";

/** Server-only service-role client. Never import in client code. */
export function createServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY — add to .env.local + Vercel env vars.");
  return createClient(url, key, { auth: { persistSession: false } });
}
