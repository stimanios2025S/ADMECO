import { createBrowserClient } from "@supabase/ssr";
import { createDemoSupabaseClient } from "./demo";
import { demoActif, erreurConfig, hasSupabaseConfig } from "./config";

export function createClient() {
  if (!hasSupabaseConfig()) {
    if (demoActif()) return createDemoSupabaseClient() as any;
    throw erreurConfig();
  }

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
