"use client";
import { useMemo, useState } from "react";
import { UserPlus, Pencil, Trash2, X, Search } from "lucide-react";
import { GlassCard, SectionTitle, Stat, StatusPill, Empty } from "@/components/admin/ui";
import { inviteMember, updateMember, removeMember } from "@/app/actions";
import { cn } from "@/lib/utils";

type Member = {
  id: string; full_name: string; role: "ADMIN" | "WORKER"; atelier_id: number | null;
  created_at: string; stats: { active: number; done: number };
};

const ATELIERS = [
  { id: 1, label: "Atelier 1 · Woodworking" },
  { id: 2, label: "Atelier 2 · Assembly & Metal" },
  { id: 3, label: "Atelier 3 · Finishing (Site B)" }
];

export default function TeamClient({ members: initial }: { members: Member[] }) {
  const [members, setMembers] = useState(initial);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | "ADMIN" | "WORKER">("ALL");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const filtered = useMemo(
    () => members.filter((m) =>
      (roleFilter === "ALL" || m.role === roleFilter) &&
      (q === "" || m.full_name.toLowerCase().includes(q.toLowerCase()))
    ),
    [members, q, roleFilter]
  );

  const admins = members.filter((m) => m.role === "ADMIN").length;
  const workers = members.filter((m) => m.role === "WORKER").length;

  return (
    <div className="stagger space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Total members" value={String(members.length)} sub="Admins + workers" accent="ice" />
        <Stat label="Admins" value={String(admins)} sub="Full control" accent="fire" />
        <Stat label="Workers" value={String(workers)} sub="Floor stations" />
      </div>

      <GlassCard>
        <SectionTitle kicker="Directory" title="Team members"
          hint="Invite by email — they can sign in immediately."
          right={
            <button onClick={() => { setInviteOpen(true); setError(""); }} className="btn-fire inline-flex items-center gap-1.5 px-4 py-2 text-sm">
              <UserPlus size={16} /> Invite member
            </button>
          } />

        <div className="mb-3 flex flex-wrap gap-2">
          <div className="glass-input flex min-w-[220px] flex-1 items-center gap-2 px-3 py-2">
            <Search size={15} className="text-zinc-500" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name…" className="w-full bg-transparent text-sm outline-none" />
          </div>
          {(["ALL", "ADMIN", "WORKER"] as const).map((r) => (
            <button key={r} onClick={() => setRoleFilter(r)}
              className={cn("rounded-xl border px-3 py-2 text-xs font-bold", roleFilter === r ? "border-fire/40 bg-fire/15 text-white" : "border-white/10 text-zinc-400")}>
              {r === "ALL" ? "Everyone" : r === "ADMIN" ? "Admins" : "Workers"}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <Empty icon="👥" title="No members found" hint="Adjust the search or invite someone." />
        ) : (
          <div className="grid gap-2.5 md:grid-cols-2">
            {filtered.map((m) => (
              <div key={m.id} className="glass-soft flex items-center gap-3 p-3.5">
                <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl text-lg font-black",
                  m.role === "ADMIN" ? "bg-gradient-to-br from-fire to-fire-soft text-[#1a0d02]" : "bg-gradient-to-br from-ice to-ice-soft text-[#04121f]")}>
                  {m.full_name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{m.full_name}</p>
                  <p className="truncate text-xs text-zinc-500">
                    {m.atelier_id ? ATELIERS.find((a) => a.id === m.atelier_id)?.label : "No atelier assigned"} · {m.stats.done} done / {m.stats.active} active
                  </p>
                  <div className="mt-1"><StatusPill status={m.role} /></div>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button onClick={() => { setEditing(m); setError(""); }} className="btn-ghost grid h-8 w-8 place-items-center" title="Edit"><Pencil size={14} /></button>
                  <button onClick={async () => {
                    if (!confirm(`Remove ${m.full_name}? Their auth account will be deleted.`)) return;
                    setBusy(true);
                    try { await removeMember(m.id); setMembers((list) => list.filter((x) => x.id !== m.id)); }
                    catch (e: any) { alert(e.message); }
                    setBusy(false);
                  }} className="grid h-8 w-8 place-items-center rounded-xl border border-red-400/25 bg-red-400/10 text-red-300 hover:bg-red-400/20" title="Remove">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {inviteOpen && (
        <MemberModal title="Invite member" error={error} busy={busy} onClose={() => setInviteOpen(false)}
          onSubmit={async (v) => {
            setBusy(true); setError("");
            try {
              const { id } = await inviteMember(v);
              setMembers((list) => [{ id, full_name: v.fullName, role: v.role, atelier_id: v.atelierId, created_at: new Date().toISOString(), stats: { active: 0, done: 0 } }, ...list]);
              setInviteOpen(false);
            } catch (e: any) { setError(friendlyError(e.message)); }
            setBusy(false);
          }} />
      )}

      {editing && (
        <MemberModal title={`Edit — ${editing.full_name}`} error={error} busy={busy} initial={editing} hideEmail onClose={() => setEditing(null)}
          onSubmit={async (v) => {
            setBusy(true); setError("");
            try {
              await updateMember({ id: editing.id, fullName: v.fullName, role: v.role, atelierId: v.atelierId });
              setMembers((list) => list.map((x) => x.id === editing.id ? { ...x, full_name: v.fullName, role: v.role, atelier_id: v.atelierId } : x));
              setEditing(null);
            } catch (e: any) { setError(friendlyError(e.message)); }
            setBusy(false);
          }} />
      )}
    </div>
  );
}

function friendlyError(msg: string) {
  if (msg.includes("SERVICE_ROLE")) return "Server is missing SUPABASE_SERVICE_ROLE_KEY — add it in Vercel env vars + .env.local, then redeploy.";
  return msg;
}

function MemberModal({ title, error, busy, initial, hideEmail, onClose, onSubmit }: {
  title: string; error: string; busy: boolean; initial?: Member; hideEmail?: boolean;
  onClose: () => void;
  onSubmit: (v: { email: string; fullName: string; role: "ADMIN" | "WORKER"; atelierId: number | null }) => void;
}) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState(initial?.full_name ?? "");
  const [role, setRole] = useState<"ADMIN" | "WORKER">(initial?.role ?? "WORKER");
  const [atelierId, setAtelierId] = useState<string>(initial?.atelier_id ? String(initial.atelier_id) : "");

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <form className="glass relative w-full max-w-md space-y-3 p-6"
        onSubmit={(e) => { e.preventDefault(); onSubmit({ email, fullName, role, atelierId: atelierId ? Number(atelierId) : null }); }}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black">{title}</h3>
          <button type="button" onClick={onClose} className="btn-ghost grid h-8 w-8 place-items-center"><X size={16} /></button>
        </div>
        {!hideEmail && (
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="Work email — e.g. karim@admeco.ma" className="glass-input w-full px-4 py-2.5 text-sm" />
        )}
        <input required value={fullName} onChange={(e) => setFullName(e.target.value)}
          placeholder="Full name" className="glass-input w-full px-4 py-2.5 text-sm" />
        <div className="grid grid-cols-2 gap-2">
          <select value={role} onChange={(e) => setRole(e.target.value as any)} className="glass-input px-3 py-2.5 text-sm">
            <option value="WORKER" className="bg-zinc-900">WORKER</option>
            <option value="ADMIN" className="bg-zinc-900">ADMIN</option>
          </select>
          <select value={atelierId} onChange={(e) => setAtelierId(e.target.value)} className="glass-input px-3 py-2.5 text-sm">
            <option value="" className="bg-zinc-900">No atelier</option>
            {ATELIERS.map((a) => <option key={a.id} value={a.id} className="bg-zinc-900">{a.label}</option>)}
          </select>
        </div>
        {error && <p className="rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-300">{error}</p>}
        <div className="flex gap-2">
          <button disabled={busy} className="btn-fire flex-1 px-4 py-2.5 text-sm">{busy ? "Saving…" : hideEmail ? "Save changes" : "Send invite"}</button>
          <button type="button" onClick={onClose} className="btn-ghost px-4 py-2.5 text-sm">Cancel</button>
        </div>
      </form>
    </div>
  );
}
