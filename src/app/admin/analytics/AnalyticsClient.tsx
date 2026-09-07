"use client";
import { useMemo } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from "recharts";
import { GlassCard, SectionTitle, Stat } from "@/components/admin/ui";

const FIRE = "#ff6a1a"; const ICE = "#2f7bff"; const ICE_SOFT = "#38e1ff"; const GREEN = "#34d399";

const tip = { backgroundColor: "#121318", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, fontSize: 12, color: "#fff" } as const;

export default function AnalyticsClient({ items, logs, steps, orders }: { items: any[]; logs: any[]; steps: any[]; orders: any[] }) {
  const m = useMemo(() => {
    const done = steps.filter((s) => s.status === "DONE");
    const overdue = steps.filter((s) => Number(s.actual_minutes) > Number(s.estimated_minutes) && s.status !== "PENDING");
    const byAtelier = [1, 2].map((a) => {
      const mine = steps.filter((s) => s.atelier_id === a);
      return { name: `Atelier ${a}`, done: mine.filter((s) => s.status === "DONE").length, active: mine.filter((s) => s.status === "ACTIVE").length, pending: mine.filter((s) => s.status === "PENDING").length };
    });
    const statusDonut = ["DONE", "ACTIVE", "PENDING", "SKIPPED"].map((st) => ({
      name: st, value: steps.filter((s) => s.status === st).length
    })).filter((x) => x.value > 0);
    const matMap = new Map<string, { used: number; lost: number }>();
    for (const l of logs) {
      const key = l.stock_items?.name ?? "?";
      const cur = matMap.get(key) ?? { used: 0, lost: 0 };
      cur.used += Number(l.quantity_used) || 0;
      cur.lost += Number(l.quantity_lost) || 0;
      matMap.set(key, cur);
    }
    const materials = [...matMap.entries()].map(([name, v]) => ({ name: name.length > 18 ? name.slice(0, 18) + "…" : name, used: +v.used.toFixed(1), lost: +v.lost.toFixed(1) })).sort((a, b) => b.used - a.used).slice(0, 8);
    const trend = orders.slice(-12).map((o) => {
      const myItems = items.filter((i) => i.order_id === o.id);
      const ready = myItems.filter((i) => i.status === "SEMI_READY" || i.status === "RELEASED").length;
      return { name: o.order_number, pct: myItems.length ? Math.round(ready / myItems.length * 100) : 0 };
    });
    return { stepsTotal: steps.length, stepsDone: done.length, overdue: overdue.length, completionPct: steps.length ? Math.round(done.length / steps.length * 100) : 0, byAtelier, statusDonut, materials, trend };
  }, [steps, logs, items, orders]);

  return (
    <div className="stagger space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Completion" value={`${m.completionPct}%`} sub={`${m.stepsDone}/${m.stepsTotal} steps`} accent="ice" />
        <Stat label="Overdue" value={String(m.overdue)} sub="Steps past target" accent={m.overdue > 0 ? "red" : "green"} />
        <Stat label="Total items" value={String(items.length)} sub="Across all orders" />
        <Stat label="Material logs" value={String(logs.length)} sub="Recorded entries" accent="fire" />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <GlassCard>
          <SectionTitle title="Throughput by atelier" />
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={m.byAtelier} barGap={3}><CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "#a1a1aa", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#a1a1aa", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tip} /><Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="done" name="Done" fill={GREEN} radius={[4, 4, 0, 0]} />
                <Bar dataKey="active" name="Active" fill={ICE} radius={[4, 4, 0, 0]} />
                <Bar dataKey="pending" name="Pending" fill="#52525b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
        <GlassCard>
          <SectionTitle title="Status mix" />
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart><Pie data={m.statusDonut} dataKey="value" nameKey="name" innerRadius={62} outerRadius={95} paddingAngle={3} strokeWidth={0}>
                {m.statusDonut.map((d) => <Cell key={d.name} fill={d.name === "DONE" ? GREEN : d.name === "ACTIVE" ? ICE : "#52525b"} />)}
              </Pie><Tooltip contentStyle={tip} /><Legend wrapperStyle={{ fontSize: 12 }} /></PieChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
        <GlassCard>
          <SectionTitle title="Yield trend per order" />
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={m.trend}><CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "#a1a1aa", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#a1a1aa", fontSize: 12 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <Tooltip contentStyle={tip} />
                <Line type="monotone" dataKey="pct" name="% Ready" stroke={ICE_SOFT} strokeWidth={3} dot={{ fill: ICE, r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
        <GlassCard>
          <SectionTitle title="Materials used vs lost" />
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={m.materials} barGap={3}><CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "#a1a1aa", fontSize: 10 }} axisLine={false} tickLine={false} interval={0} angle={-20} dy={10} height={50} />
                <YAxis tick={{ fill: "#a1a1aa", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tip} /><Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="used" name="Used" fill={ICE} radius={[4, 4, 0, 0]} />
                <Bar dataKey="lost" name="Lost" fill={FIRE} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
