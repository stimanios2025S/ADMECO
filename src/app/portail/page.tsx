"use client";
import { useState } from "react";
import { LogIn, Loader2, Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function PagePortail() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showPw, setShowPw] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const supabase = createClient();
      const { error: authErr } = await supabase.auth.signInWithPassword({ email, password });
      if (authErr) { setError(authErr.message); setBusy(false); return; }
      const res = await fetch("/api/mon-profil");
      if (!res.ok) { setError("Impossible de charger votre profil. Veuillez réessayer."); setBusy(false); return; }
      // Le serveur décide où va chaque métier — et surtout, il ouvre à
      // l'ouvrier SON atelier au lieu d'un portail générique.
      router.push("/redirection");
      router.refresh();
    } catch {
      setError("Erreur de connexion. Veuillez réessayer.");
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f3f0eb] p-6">
      <div className="w-full max-w-[420px] rounded-3xl border border-black/5 bg-white p-8 shadow-xl shadow-black/5">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#4a7c59] text-xl font-black text-white shadow-lg">🪑</div>
          <div>
            <p className="text-lg font-extrabold tracking-tight text-[#1a1d23]">Portail Ateliers</p>
            <p className="text-[12px] text-[#7c8091]">Connectez-vous pour rejoindre votre atelier</p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[12px] font-semibold text-[#7c8091]">Adresse e-mail</label>
            <input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="nom@usine.com"
              className="input w-full px-4 py-3.5 text-[15px]"
              autoComplete="email" autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[12px] font-semibold text-[#7c8091]">Mot de passe</label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input w-full px-4 py-3.5 pr-11 text-[15px]"
                autoComplete="current-password"
              />
              <button type="button" onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 grid h-7 w-7 place-items-center rounded-lg text-[#7c8091] hover:text-[#1a1d23] transition-colors">
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-medium text-red-600">
              {error}
            </div>
          )}

          <button disabled={busy} className="btn-accent flex w-full items-center justify-center gap-2.5 px-4 py-4 text-[15px]">
            {busy ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
            {busy ? "Connexion en cours…" : "Se connecter"}
          </button>
        </form>
      </div>
    </div>
  );
}
