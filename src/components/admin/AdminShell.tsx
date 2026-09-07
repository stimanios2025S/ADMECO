"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Package, Warehouse, Route, Siren, Users, BarChart3,
  Menu, X, Wifi, WifiOff, Layers, TabletSmartphone, ChevronLeft, ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import UserChip from "./UserChip";

const TABS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/orders", label: "Orders", icon: Package },
  { href: "/admin/stocks", label: "Stocks", icon: Warehouse },
  { href: "/admin/incidents", label: "Incidents", icon: Siren },
  { href: "/admin/team", label: "Team", icon: Users },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 }
];

export default function AdminShell({ children, pageTitle, pageHint }: { children: ReactNode; pageTitle: string; pageHint?: string }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const sidebarBody = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-4 pt-5">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-fire to-fire-soft text-xl font-black text-[#1a0d02] shadow-fire">🪑</div>
        {!collapsed && <div><p className="truncate text-[15px] font-black tracking-tight">ADMECO <span className="text-fire">MES</span></p><p className="text-[11px] text-zinc-500">Factory command center</p></div>}
      </div>
      <nav className="mt-6 flex-1 space-y-1 px-3">
        {TABS.map((t) => {
          const active = pathname === t.href || (t.href === "/admin/orders" && pathname.startsWith("/admin/orders"));
          const Icon = t.icon;
          return (
            <Link key={t.href} href={t.href} title={collapsed ? t.label : undefined}
              className={cn("group flex items-center gap-3 rounded-xl border px-3 py-2.5 transition",
                active ? "border-fire/30 bg-gradient-to-r from-fire/20 to-transparent text-white shadow-fire" : "border-transparent text-zinc-400 hover:border-white/10 hover:bg-white/5 hover:text-white")}>
              <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg",
                active ? "bg-gradient-to-br from-fire to-fire-soft text-[#1a0d02]" : "bg-white/5 text-zinc-300")}>
                <Icon size={17} strokeWidth={2.4} />
              </span>
              {!collapsed && <span className="min-w-0 truncate text-sm font-bold">{t.label}</span>}
              {!collapsed && active && <span className="ml-auto h-2 w-2 rounded-full bg-fire" />}
            </Link>
          );
        })}
      </nav>
      {!collapsed && (
        <div className="space-y-2 px-3 pb-2">
          <Link href="/portal" className="flex items-center gap-2.5 rounded-xl border border-ice/25 bg-ice/10 px-3 py-2.5 text-sm font-bold text-ice-soft hover:bg-ice/20">
            <TabletSmartphone size={16} /> Worker portal
          </Link>
        </div>
      )}
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold bg-emerald-400/10 text-emerald-300">
          <Wifi size={14} />{!collapsed && "All systems live"}
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-mesh min-h-screen text-zinc-100">
      <div className="bg-grid-faint pointer-events-none fixed inset-0" />
      <aside className={cn("fixed inset-y-0 left-0 z-40 hidden border-r border-white/10 bg-black/50 backdrop-blur-2xl transition-all duration-300 lg:block",
        collapsed ? "w-[76px]" : "w-[264px]")}>
        {sidebarBody}
        <button onClick={() => setCollapsed((c) => !c)}
          className="absolute -right-3.5 top-20 grid h-7 w-7 place-items-center rounded-full border border-white/15 bg-[#121318] text-zinc-300 shadow-lg hover:text-white"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[280px] border-r border-white/10 bg-[#0b0c10]/95 backdrop-blur-2xl">{sidebarBody}</aside>
        </div>
      )}
      <div className={cn("relative transition-all duration-300", collapsed ? "lg:pl-[76px]" : "lg:pl-[264px]")}>
        <header className="sticky top-0 z-30 border-b border-white/10 bg-[#07080b]/70 backdrop-blur-2xl">
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
            <button onClick={() => setMobileOpen(true)} className="btn-ghost grid h-10 w-10 place-items-center lg:hidden" aria-label="Menu">
              {mobileOpen ? <X size={19} /> : <Menu size={19} />}
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">
                <span className="live-dot mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                ADEMCO · live
              </p>
              <h1 className="truncate text-lg font-black tracking-tight sm:text-xl">{pageTitle}</h1>
              {pageHint && <p className="hidden truncate text-xs text-zinc-500 sm:block">{pageHint}</p>}
            </div>
            <span className="hidden items-center gap-1.5 rounded-full border border-fire/25 bg-fire/10 px-3 py-1.5 text-xs font-bold text-fire-soft sm:inline-flex">🪑 Factory OS</span>
            <UserChip />
          </div>
          <nav className="flex gap-1 overflow-x-auto px-4 pb-3 lg:hidden">
            {TABS.map((t) => {
              const active = pathname === t.href;
              return (
                <Link key={t.href} href={t.href} className={cn("flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold",
                  active ? "border-fire/30 bg-fire/15 text-white" : "border-white/10 text-zinc-400")}>
                  <t.icon size={14} /> {t.label}
                </Link>
              );
            })}
          </nav>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      </div>
    </div>
  );
}
