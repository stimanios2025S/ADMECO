"use client";
import { useState } from "react";
import { LogIn, Loader2, Eye, EyeOff, ArrowRight, Shield, Factory, TabletSmartphone, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const PORTAILS = [
  { role: "ADMIN", href: "/admin", icon: "📊", label: "Administration", desc: "Tableau de bord, commandes, stocks, analytique", color: "#4a7c59" },
  { role: "WORKSHOP", href: "/portal?atelier=1", icon: "🪚", label: "Atelier 1 — Bois & Découpe", desc: "Portail opérateur · 5 étapes · DEP-MP → Stock A1", color: "#c24a08" },
  { role: "WAREHOUSE", href: "/portal?atelier=2", icon: "🔧", label: "Atelier 2 — Assemblage & Finition", desc: "Portail opérateur · 6 étapes · A1 + DEP-MP → Stock A2", color: "#2f6eb5" },
] as const;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [step, setStep] = useState<"login" | "choose">("login");
  const [userRole, setUserRole] = useState<string>("");
  const [userName, setUserName] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { data, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
    if (authErr) { setError(authErr.message); setBusy(false); return; }
    const user = data?.user as any;
    const role = user?.role ?? "ADMIN";
    const name = user?.full_name ?? user?.email ?? "";
    setUserRole(role);
    setUserName(name);
    setStep("choose");
    setBusy(false);
  };

  const handlePortalChoice = (href: string) => {
    router.push(href);
    router.refresh();
  };

  return (
    <div className="min-h-screen flex">
      {/* ── Panneau gauche : branding ── */}
      <div className="hidden lg:flex lg:w-[52%] relative overflow-hidden bg-gradient-to-br from-[#1a2e1f] via-[#1a2420] to-[#0f1a12]">
        {/* Motif décoratif */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
        {/* Glow */}
        <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] rounded-full bg-[#4a7c59]/10 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] rounded-full bg-[#c24a08]/8 blur-[100px]" />

        <div className="relative z-10 flex flex-col justify-between p-10 xl:p-14 w-full">
          {/* Logo */}
          <div>
            <div className="flex items-center gap-3">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#4a7c59] text-2xl font-black text-white shadow-lg shadow-[#4a7c59]/30">
                🪑
              </div>
              <div>
                <p className="text-xl font-extrabold tracking-tight text-white">ADMEDCO <span className="text-[#6fa67d]">MES</span></p>
                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/40">Manufacturing Execution System</p>
              </div>
            </div>
          </div>

          {/* Centre — features */}
          <div className="space-y-8">
            <div>
              <h2 className="text-4xl font-black leading-tight tracking-tight text-white xl:text-5xl">
                Gérez votre production<br />
                <span className="text-[#6fa67d]">en temps réel.</span>
              </h2>
              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/50">
                Du bois brut au meuble fini — suitrez chaque étape, chaque atelier, chaque gramme de matière première.
              </p>
            </div>

            <div className="grid gap-4 max-w-lg">
              {[
                { icon: <Factory size={18} />, title: "2 ateliers connectés", desc: "Bois & Découpe → Assemblage & Finition" },
                { icon: <TabletSmartphone size={18} />, title: "Portails opérateur", desc: "QR scan, timer, déclaration matière en temps réel" },
                { icon: <Shield size={18} />, title: "Traçabilité totale", desc: "Stock MP centrale, réservation, consommation déclarée" },
              ].map((f, i) => (
                <div key={i} className="flex items-start gap-3.5 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 backdrop-blur-sm">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#4a7c59]/20 text-[#6fa67d]">{f.icon}</span>
                  <div>
                    <p className="text-sm font-bold text-white">{f.title}</p>
                    <p className="mt-0.5 text-[13px] text-white/40">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bas — version */}
          <div className="text-[12px] text-white/25">
            ADMEDCO MES v2.0 · Système de fabrication de meubles
          </div>
        </div>
      </div>

      {/* ── Panneau droit : formulaire ── */}
      <div className="flex flex-1 items-center justify-center bg-[#f3f0eb] p-6 sm:p-10">
        <div className="w-full max-w-[420px]">
          {/* Logo mobile */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#4a7c59] text-xl font-black text-white shadow-lg">🪑</div>
            <div>
              <p className="text-lg font-extrabold tracking-tight text-[#1a1d23]">ADMEDCO <span className="text-[#4a7c59]">MES</span></p>
              <p className="text-[11px] text-[#7c8091]">Manufacturing Execution System</p>
            </div>
          </div>

          {step === "login" ? (
            /* ── Étape 1 : Formulaire de connexion ── */
            <div className="animate-fade-up">
              <div className="mb-6">
                <div className="mb-3 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#4a7c59] live-dot" />
                  <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#4a7c59]">Système en ligne</span>
                </div>
                <h1 className="text-3xl font-extrabold tracking-tight text-[#1a1d23]">Connexion</h1>
                <p className="mt-1.5 text-[14px] text-[#7c8091]">Accédez à votre portail ADMEDCO</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[12px] font-semibold text-[#7c8091]">Adresse e-mail</label>
                  <div className="relative">
                    <input
                      type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="vous@admedco.ma"
                      className="input w-full px-4 py-3.5 text-[15px]"
                      autoComplete="email" autoFocus
                    />
                  </div>
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

              <div className="mt-6 rounded-2xl border border-black/5 bg-white/60 p-4">
                <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#7c8091]">Comptes de démonstration</p>
                <div className="space-y-2">
                  {[
                    { email: "admin@admedco.ma", pw: "Admin123!", role: "Directeur", icon: "📊" },
                    { email: "atelier1@admedco.ma", pw: "Atelier123!", role: "Chef Atelier 1", icon: "🪚" },
                    { email: "atelier2@admedco.ma", pw: "Atelier123!", role: "Chef Atelier 2", icon: "🔧" },
                  ].map((u) => (
                    <button key={u.email} type="button"
                      onClick={() => { setEmail(u.email); setPassword(u.pw); }}
                      className="flex w-full items-center gap-3 rounded-xl border border-black/5 bg-white px-3.5 py-2.5 text-left transition hover:border-[#4a7c59]/20 hover:bg-[#4a7c59]/[0.02] group">
                      <span className="text-lg">{u.icon}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-bold text-[#1a1d23]">{u.email}</p>
                        <p className="text-[11px] text-[#7c8091]">{u.role} · {u.pw}</p>
                      </div>
                      <ChevronRight size={14} className="text-[#7c8091] group-hover:text-[#4a7c59] transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* ── Étape 2 : Choix du portail ── */
            <div className="animate-fade-up">
              <div className="mb-6">
                <div className="mb-3 flex items-center gap-2">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#4a7c59] text-sm font-bold text-white">
                    {userName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#1a1d23]">{userName}</p>
                    <p className="text-[11px] text-[#7c8091]">Connecté · choisissez votre portail</p>
                  </div>
                </div>
                <h1 className="text-3xl font-extrabold tracking-tight text-[#1a1d23]">Votre portail</h1>
                <p className="mt-1.5 text-[14px] text-[#7c8091]">Sélectionnez l'espace auquel vous souhaitez accéder</p>
              </div>

              <div className="space-y-3">
                {PORTAILS.map((p) => {
                  const recommended = p.role === userRole;
                  return (
                    <button key={p.role} onClick={() => handlePortalChoice(p.href)}
                      className={`w-full text-left rounded-2xl border p-5 transition-all group ${
                        recommended
                          ? "border-[#4a7c59]/30 bg-[#4a7c59]/[0.04] hover:border-[#4a7c59]/50 hover:bg-[#4a7c59]/[0.08]"
                          : "border-black/6 bg-white hover:border-black/12 hover:shadow-md"
                      }`}>
                      <div className="flex items-start gap-4">
                        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-2xl" style={{ backgroundColor: `${p.color}10` }}>
                          {p.icon}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-[15px] font-bold text-[#1a1d23]">{p.label}</p>
                            {recommended && (
                              <span className="rounded-full bg-[#4a7c59]/10 px-2 py-0.5 text-[10px] font-bold text-[#4a7c59]">RECOMMANDÉ</span>
                            )}
                          </div>
                          <p className="mt-0.5 text-[13px] text-[#7c8091]">{p.desc}</p>
                        </div>
                        <ArrowRight size={18} className="mt-1 shrink-0 text-[#7c8091] group-hover:text-[#4a7c59] group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </button>
                  );
                })}
              </div>

              <button onClick={() => { setStep("login"); setError(""); }}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-black/8 bg-transparent px-4 py-3 text-[13px] font-semibold text-[#7c8091] hover:bg-black/3 transition">
                ← Retour à la connexion
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
