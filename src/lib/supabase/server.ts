import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createDemoSupabaseClient } from "./demo";
import { demoActif, erreurConfig, hasSupabaseConfig } from "./config";

export function createServerSupabase() {
  if (!hasSupabaseConfig()) {
    if (demoActif()) return createDemoSupabaseClient() as any;
    throw erreurConfig();
  }

  const store = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return store.get(name)?.value; },
        set(name: string, value: string, options?: Record<string, any>) {
          try { store.set({ name, value, ...options }); } catch {}
        },
        remove(name: string, options?: Record<string, any>) {
          try { store.set({ name, value: "", ...options }); } catch {}
        }
      }
    }
  );
}
