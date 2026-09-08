"use client";
import { useMemo, useState } from "react";
import { ArrowRight, BriefcaseBusiness, Factory, KeyRound, LogIn, Loader2, PackageCheck, ShieldCheck, Sparkles, Warehouse } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseConfig } from "@/lib/supabase/demo";

const portals = [
  {
    id: "admin",
    label: "ERP Control Center",
    name: "Executive Admin",
    email: "admin@admeco.ma",
    password: "Admin123!",
    icon: BriefcaseBusiness,
    accent: "from-fire to-orange-400",
    description: "Operations, orders, analytics, teams, and stock governance."
  },
  {
    id: "factory",
    label: "Workshop Portal",
    name: "Factory Supervisor",
    email: "factory@admeco.ma",
    password: "Factory123!",
    icon: Factory,
    accent: "from-sky-500 to-cyan-400",
    description: "Step execution, QR intake, production timing, and line control."
  },
  {
    id: "warehouse",
    label: "Warehouse Portal",
    name: "Warehouse Lead",
    email: "warehouse@admeco.ma",
    password: "Warehouse123!",
    icon: Warehouse,
    accent: "from-emerald-500 to-teal-400",
    description: "Material movement, inventory, and dispatch visibility."
  }
] as const;

export default function LoginPage() {
  const router = useRouter();
  const demoMode = !hasSupabaseConfig();
  const [selectedPortal, setSelectedPortal] = useState<(typeof portals)[number]["id"]>("admin");
  const [email, setEmail] = useState(demoMode ? "admin@admeco.ma" : "");
  const [password, setPassword] = useState(demoMode ? "Admin123!" : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const activePortal = useMemo(
    () => portals.find((portal) => portal.id === selectedPortal) ?? portals[0],
    [selectedPortal]
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");

    const supabase = createClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError || !data?.user) {
      setError(signInError?.message ?? "Invalid credentials");
      setBusy(false);
      return;
    }

    const chosenPortal = selectedPortal || activePortal.id;
    const targetPath = chosenPortal === "admin" ? "/admin" : "/portal" + (chosenPortal === "warehouse" ? "?mode=warehouse" : "?mode=factory");
    router.push(targetPath);
    router.refresh();
    setBusy(false);
  };

  return (
    <div className="bg-mesh relative min-h-screen overflow-hidden px-4 py-8 text-zinc-100 sm:px-6 lg:px-8">
      <div className="bg-grid-faint pointer-events-none fixed inset-0" />
      <div className="hero-orb left-[-80px] top-[-20px]" />
      <div className="hero-orb bottom-[-60px] right-[-40px] opacity-80" />

      <div className="relative z-10 mx-auto grid w-full max-w-7xl overflow-hidden rounded-[30px] border border-white/10 bg-[#0a0f17]/85 shadow-[0_35px_120px_rgba(0,0,0,0.45)] backdrop-blur-2xl lg:grid-cols-[1.15fr_0.85fr]">
        <div className="relative hidden min-h-[780px] flex-col justify-between overflow-hidden border-r border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(255,122,26,0.16),transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(93,164,255,0.14),transparent_40%),linear-gradient(160deg,rgba(9,12,18,0.96),rgba(16,20,29,0.92))] p-8 lg:flex">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-fire to-fire-soft text-2xl shadow-[0_18px_35px_rgba(255,122,26,0.35)]">🪑</div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-zinc-400">ADMECO</p>
              <h1 className="text-2xl font-black tracking-tight">ERP Suite</h1>
            </div>
          </div>

          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-ice/35 bg-ice/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-ice-soft">
              <Sparkles size={12} /> Manufacturing intelligence
            </div>

            <div className="space-y-4">
              <h2 className="max-w-xl text-5xl font-black leading-[1.05] tracking-[-0.06em] text-white">
                Professional ERP for <span className="text-fire">modern production</span>.
              </h2>
              <p className="max-w-lg text-base leading-7 text-zinc-300">
                Control orders, stock, floor execution, team operations, and business performance from one secure command center.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: "Orders", value: "1.2k" },
                { label: "Yield", value: "98.4%" },
                { label: "Alerts", value: "06" }
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm">
                  <p className="text-2xl font-black text-white">{stat.value}</p>
                  <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-400">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-emerald-400/30 to-emerald-300/10 text-emerald-300">
                <ShieldCheck size={18} />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Operationally secure</p>
                <p className="text-xs text-zinc-400">Role-based access control with live factory monitoring</p>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-4 text-sm text-zinc-300">
              <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-400">
                <PackageCheck size={12} /> Modules
              </div>
              <div className="grid gap-2 text-sm text-zinc-200 sm:grid-cols-2">
                <span>• Orders</span>
                <span>• Logistics</span>
                <span>• Stock</span>
                <span>• Workforce</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center p-5 sm:p-8">
          <form className="w-full max-w-xl space-y-5 rounded-[26px] border border-white/10 bg-[rgba(12,16,22,0.78)] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-7" onSubmit={handleSubmit}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-zinc-500">Secure access</p>
                <h3 className="mt-1 text-2xl font-black tracking-tight text-white">Login to your portal</h3>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-400" /> Live
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {portals.map((portal) => {
                const Icon = portal.icon;
                const selected = activePortal.id === portal.id;
                return (
                  <button
                    key={portal.id}
                    type="button"
                    onClick={() => {
                      setSelectedPortal(portal.id);
                      setEmail(portal.email);
                      setPassword(portal.password);
                    }}
                    className={`group rounded-2xl border p-3 text-left transition ${selected ? "border-ice/50 bg-white/8 shadow-[0_0_0_1px_rgba(122,204,255,0.25)]" : "border-white/10 bg-white/5 hover:border-white/20"}`}
                  >
                    <div className={`mb-3 grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br ${portal.accent}`}>
                      <Icon size={18} className="text-white" />
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400">{portal.label}</div>
                    <div className="mt-1 text-sm font-black text-white">{portal.name}</div>
                  </button>
                );
              })}
            </div>

            {demoMode && (
              <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                <div className="mb-2 flex items-center gap-2 font-bold uppercase tracking-[0.18em] text-amber-300">
                  <KeyRound size={12} /> Demo credentials
                </div>
                <div className="space-y-2 text-[12px] text-amber-100">
                  <div><span className="font-bold">Admin:</span> admin@admeco.ma / Admin123!</div>
                  <div><span className="font-bold">Factory:</span> factory@admeco.ma / Factory123!</div>
                  <div><span className="font-bold">Warehouse:</span> warehouse@admeco.ma / Warehouse123!</div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-400">Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@admeco.ma" className="glass-input w-full px-4 py-3.5 text-sm" autoComplete="email" />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-400">Password</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="glass-input w-full px-4 py-3.5 text-sm" autoComplete="current-password" />
            </div>

            {error && <p className="rounded-2xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>}

            <button disabled={busy} className="btn-fire flex w-full items-center justify-center gap-2 px-4 py-3.5 text-sm font-bold">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
              {busy ? "Signing in…" : `Open ${activePortal.label}`}
            </button>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center text-xs text-zinc-400">
              Need a quick launch? <span className="inline-flex items-center gap-1 font-bold text-ice-soft">Use the selected portal <ArrowRight size={12} /></span>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
