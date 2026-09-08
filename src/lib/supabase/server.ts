import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createDemoSupabaseClient, hasSupabaseConfig } from "./demo";

export function createServerSupabase() {
  if (!hasSupabaseConfig()) return createDemoSupabaseClient() as any;

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
