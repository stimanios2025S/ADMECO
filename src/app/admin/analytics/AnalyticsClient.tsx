"use client";
import { useMemo } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from "recharts";
import { GlassCard, SectionTitle, Stat } from "@/components/admin/ui";

const FIRE = "#ff6a1a";
const ICE = "#2f7bff";
const ICE_SOFT = "#38e1ff";
const GREEN = "#34d399";
const AMBER = "#fbbf24";

const tooltipStyle = {
  backgroundColor: "#121318",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 12,
  fontSize: 12,
  color: "#fff"
} as const;

export default function AnalyticsClient({ steps, orders, logs }: { steps: any[]; orders: any[]; logs: any[] }) {
  const m = useMemo(() => {
    const done = steps.filter((s) => s.status === "DONE");
    const good = steps.reduce((a, s) => a + (Number(s.good_units) || 0), 0);
    const scrap = steps.reduce((a, s) => a + (Number(s.scrap_units) || 0), 0);
    const expected = steps.reduce((a, s) => a + (Number(s.expected_units) || 0), 0);
    const yieldPct = expected > 0 ? (good / expected) * 100 : 0;
    const scrapPct = good + scrap > 0 ? (scrap / (good + scrap)) * 100 : 0;
    const overdue = steps.filter((s) => Number(s.actual_minutes) > Number(s.estimated_minutes) && s.status !== "PENDING");

    // throughput per atelier
    const byAtelier = [1, 2, 3].map((a) => {
      const mine = steps.filter((s) => s.atelier_id === a);
      return {
        name: `Atelier ${a}`,
        done: mine.filter((s) => s.status === "DONE").length,
        active: mine.filter((s) => s.status === "ACTIVE").length,
        pending: mine.filter((s) => s.status === "PENDING").length,
        rework: mine.filter((s) => s.status === "REWORK").length
      };
    });

    // scrap per order (top 8)
    const scrapByOrder = new Map<string, number>();
    for (const s of steps) {
      const key = s.work_orders?.order_number ?? "—";
      scrapByOrder.set(key, (scrapByOrder.get(key) ?? 0) + (Number(s.scrap_units) || 0));
    }
    const scrapTop = [...scrapByOrder.entries()]
      .map(([name, units]) => ({ name, units }))
      .filter((x) => x.units > 0)
      .sort((a, b) => b.units - a.units)
      .slice(0, 8);

    // variance per step for worst 10 (by order)
    const worst = [...steps]
      .filter((s) => Number(s.actual_minutes) > Number(s.estimated_minutes) && s.status !== "PENDING")
      .map((s) => ({
        name: `#${s.step_order} ${String(s.step_name).slice(0, 22)}`,
        variance: Number((Number(s.actual_minutes) - Number(s.estimated_minutes)).toFixed(1))
      }))
      .sort((a, b) => b.variance - a.variance)
      .slice(0, 10);

    // status donut
    const statuses = ["DONE", "ACTIVE", "PENDING", "PAUSED", "REWORK"];
    const donut = statuses.map((st) => ({
      name: st, value: steps.filter((s) => s.status === st).length
    })).filter((x) => x.value > 0);

    // materials top 6 by used
    const matMap = new Map<string, { used: number; lost: number }>();
    for (const l of logs) {
      const cur = matMap.get(l.material_name) ?? { used: 0, lost: 0 };
      cur.used += Number(l.quantity_used) || 0;
      cur.lost += Number(l.quantity_lost) || 0;
      matMap.set(l.material_name, cur);
    }
    const materials = [...matMap.entries()]
      .map(([name, v]) => ({ name: name.length > 20 ? name.slice(0, 20) + "…" : name, used: +v.used.toFixed(1), lost: +v.lost.toFixed(1) }))
      .sort((a, b) => b.used - a.used)
      .slice(0, 6);

    // yield trend: per order completion order
    const trend = orders.slice(0, 12).reverse().map((o: any) => {
      const mine = steps.filter((s) => s.work_order_id === o.id);
      const g = mine.reduce((a, s) => a + (Number(s.good_units) || 0), 0);
      const e = mine.reduce((a, s) => a + (Number(s.expected_units) || 0), 0);
      return { name: o.order_number, yield: e > 0 ? +((g / e) * 100).toFixed(1) : 0 };
    });

    return { done: done.length, yieldPct, scrapPct, overdue: overdue.length, byAtelier, scrapTop, worst, donut, materials, trend };
  }, [steps, orders, logs]);

  return (
    <div className="stagger space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Platform yield" value={`${m.yieldPct.toFixed(1)}%`} sub="Good ÷ expected units" accent="ice" />
        <Stat label="Scrap rate" value={`${m.scrapPct.toFixed(1)}%`} sub="Limit: 5% per batch" accent={m.scrapPct > 5 ? "red" : "green"} />
        <Stat label="Steps completed" value={String(m.done)} sub={`of ${steps.length} tracked`} />
        <Stat label="Overdue steps" value={String(m.overdue)} sub="Past target time" accent={m.overdue > 0 ? "fire" : undefined} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <GlassCard>
          <SectionTitle kicker="Throughput" title="Steps by atelier & status" hint="Where work sits right now." />
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={m.byAtelier} barGap={3}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "#a1a1aa", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#a1a1aa", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="done" name="Done" fill={GREEN} radius={[4, 4, 0, 0]} />
                <Bar dataKey="active" name="Active" fill={ICE} radius={[4, 4, 0, 0]} />
                <Bar dataKey="pending" name="Pending" fill="#52525b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="rework" name="Rework" fill={FIRE} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard>
          <SectionTitle kicker="Health" title="Step status mix" hint="Share of every state platform-wide." />
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={m.donut} dataKey="value" nameKey="name" innerRadius={62} outerRadius={95} paddingAngle={3} strokeWidth={0}>
                  {m.donut.map((d) => (
                    <Cell key={d.name} fill={d.name === "DONE" ? GREEN : d.name === "ACTIVE" ? ICE : d.name === "REWORK" ? FIRE : d.name === "PAUSED" ? AMBER : "#52525b"} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard>
          <SectionTitle kicker="Quality" title="Yield trend per order" hint="Good units ÷ expected, latest orders." />
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={m.trend}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "#a1a1aa", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#a1a1aa", fontSize: 12 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="yield" name="Yield %" stroke={ICE_SOFT} strokeWidth={3} dot={{ fill: ICE, r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard>
          <SectionTitle kicker="Waste" title="Scrap units per order" hint="Top 8 — investigate the tallest bars." />
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={m.scrapTop} layout="vertical">
                <CartesianGrid stroke="rgba(255,255,255,0.06)" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#a1a1aa", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: "#a1a1aa", fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="units" name="Scrap units" fill={FIRE} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard>
          <SectionTitle kicker="Time" title="Worst time overruns" hint="Top 10 steps past target (minutes)." />
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={m.worst} layout="vertical">
                <CartesianGrid stroke="rgba(255,255,255,0.06)" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#a1a1aa", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: "#a1a1aa", fontSize: 11 }} axisLine={false} tickLine={false} width={130} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="variance" name="Over min" fill="#f43f5e" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard>
          <SectionTitle kicker="Materials" title="Top materials used vs lost" hint="From floor material logs." />
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={m.materials} barGap={3}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "#a1a1aa", fontSize: 10 }} axisLine={false} tickLine={false} interval={0} angle={-18} dy={10} height={60} />
                <YAxis tick={{ fill: "#a1a1aa", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
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
