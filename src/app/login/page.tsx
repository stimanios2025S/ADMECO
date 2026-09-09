"use client";
import { useState } from "react";
import { LogIn, Loader2, Factory, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  return (
    <div className="min-h-screen bg-[#f3f0eb] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo & title */}
        <div className="text-center mb-8">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-[#4a7c59] text-3xl font-black text-white shadow-lg mb-4">
            🪑
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#1a1d23]">
            ADMEDCO <span className="text-[#4a7c59]">MES</span>
          </h1>
          <p className="mt-1 text-[14px] text-[#7c8091]">Centre de commande de l'usine</p>
        </div>

        {/* Login card */}
        <div className="card p-6 sm:p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7c8091]">Accès sécurisé</p>
              <h2 className="text-xl font-extrabold text-[#1a1d23]">Connectez-vous à votre portail</h2>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-[#4a7c59]/10 px-2.5 py-1 text-[11px] font-semibold text-[#4a7c59]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#4a7c59] live-dot" /> En direct
            </div>
          </div>

          <form onSubmit={async (e) => {
            e.preventDefault(); setBusy(true); setError("");
            const supabase = createClient();
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) { setError(error.message); setBusy(false); return; }
            router.push("/admin"); router.refresh();
          }}>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[12px] font-semibold text-[#7c8091]">E-mail</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="vous@admedco.ma" className="input w-full px-4 py-3 text-sm" autoComplete="email" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-semibold text-[#7c8091]">Mot de passe</label>
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mot de passe" className="input w-full px-4 py-3 text-sm" autoComplete="current-password" />
              </div>
            </div>

            {error && (
              <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-500">{error}</p>
            )}

            <button disabled={busy} className="btn-accent mt-5 flex w-full items-center justify-center gap-2 px-4 py-3.5 text-sm">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
              {busy ? "Connexion…" : "Se connecter"}
            </button>
          </form>

          <div className="mt-4 flex items-center justify-center gap-1.5 text-[12px] text-[#7c8091]">
            <Factory size={14} />
            Opérateur sur tablette ? <a href="/portal" className="font-semibold text-[#4a7c59] hover:underline">Ouvrir le portail atelier <ArrowRight size={12} className="inline" /></a>
          </div>
        </div>
      </div>
    </div>
  );
}
