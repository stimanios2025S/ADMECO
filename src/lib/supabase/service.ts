import { createClient } from "@supabase/supabase-js";

/** Server-only service-role client for admin operations (team management). Never import in client code. */
export function createServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY — add it to .env.local (server-only) to enable Team Management."
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
