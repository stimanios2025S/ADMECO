import { createBrowserClient } from "@supabase/ssr";
import { createDemoSupabaseClient, hasSupabaseConfig } from "./demo";

export function createClient() {
  if (!hasSupabaseConfig()) return createDemoSupabaseClient() as any;

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
