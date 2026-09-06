"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  return (
    <div className="bg-mesh grid min-h-screen place-items-center px-4">
      <div className="bg-grid-faint pointer-events-none fixed inset-0" />
      <form
        className="glass animate-fade-up relative w-full max-w-sm space-y-4 p-8"
        onSubmit={async (e) => {
          e.preventDefault(); setBusy(true); setError("");
          const supabase = createClient();
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) { setError(error.message); setBusy(false); return; }
          router.push("/admin");
          router.refresh();
        }}
      >
        <div className="text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-fire to-fire-soft text-3xl shadow-fire">🪑</div>
          <h1 className="mt-3 text-2xl font-black tracking-tight">ADMECO <span className="text-fire">MES</span></h1>
          <p className="mt-1 text-sm text-zinc-500">Admin sign-in — factory command center</p>
        </div>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="you@admeco.ma" className="glass-input w-full px-4 py-3 text-sm" autoComplete="email" />
        <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="Password" className="glass-input w-full px-4 py-3 text-sm" autoComplete="current-password" />
        {error && <p className="rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-300">{error}</p>}
        <button disabled={busy} className="btn-fire flex w-full items-center justify-center gap-2 px-4 py-3 text-sm">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <p className="text-center text-xs text-zinc-500">
          Worker on a tablet? <a href="/portal" className="font-bold text-ice-soft hover:underline">Open Worker Portal →</a>
        </p>
      </form>
    </div>
  );
}
