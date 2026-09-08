"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function UserChip() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [initial, setInitial] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then((result: any) => {
      const e = result.data.user?.email ?? null;
      setEmail(e);
      if (e) setInitial(e.charAt(0).toUpperCase());
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e: string, session: any) => {
      const e = session?.user?.email ?? null;
      setEmail(e);
      if (e) setInitial(e.charAt(0).toUpperCase());
    }) as any;
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!email) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="hidden max-w-[160px] truncate rounded-full border border-black/8 bg-[#f0ede8] px-3 py-1.5 text-[12px] font-semibold text-[#7c8091] md:block" title={email}>
        {email}
      </span>
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#4a7c59] text-[13px] font-bold text-white" title={email}>
        {initial}
      </div>
      <button
        onClick={async () => { await createClient().auth.signOut(); router.push("/login"); router.refresh(); }}
        className="grid h-9 w-9 place-items-center rounded-xl hover:bg-black/5 text-[#7c8091] hover:text-[#1a1d23] transition-colors" title="Sign out">
        <LogOut size={16} />
      </button>
    </div>
  );
}
