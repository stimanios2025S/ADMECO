"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function UserChip() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then((result: any) => setEmail(result.data.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e: string, session: any) => setEmail(session?.user?.email ?? null)) as any;
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!email) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="hidden max-w-[160px] truncate rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-zinc-300 md:block" title={email}>
        {email}
      </span>
      <button
        onClick={async () => { await createClient().auth.signOut(); router.push("/login"); router.refresh(); }}
        className="btn-ghost grid h-9 w-9 place-items-center text-zinc-400 hover:text-white" title="Sign out">
        <LogOut size={16} />
      </button>
    </div>
  );
}
