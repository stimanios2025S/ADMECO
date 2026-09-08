"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Package, Warehouse, Siren, Users, BarChart3,
  Menu, X, TabletSmartphone, ChevronLeft, ChevronRight, Bell, Settings
} from "lucide-react";
import { cn } from "@/lib/utils";
import UserChip from "./UserChip";

const TABS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/orders", label: "Orders", icon: Package },
  { href: "/admin/stocks", label: "Stocks", icon: Warehouse },
  { href: "/admin/incidents", label: "Incidents", icon: Siren },
  { href: "/admin/team", label: "Team", icon: Users },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
];

export default function AdminShell({ children, pageTitle, pageHint }: { children: ReactNode; pageTitle: string; pageHint?: string }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  };

  const sidebarBody = (
    <div className="flex h-full flex-col bg-white">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 pt-6 pb-5">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#4a7c59] text-xl font-black text-white shadow-sm">🪑</div>
        {!collapsed && (
          <div>
            <p className="text-[15px] font-extrabold tracking-tight text-[#1a1d23]">ADMECO <span className="text-[#4a7c59]">MES</span></p>
            <p className="text-[11px] text-[#7c8091]">Factory command center</p>
          </div>
        )}
      </div>

      {/* Main nav */}
      <nav className="flex-1 space-y-1 px-3">
        {TABS.map((t) => {
          const active = isActive(t.href);
          const Icon = t.icon;
          return (
            <Link key={t.href} href={t.href} title={collapsed ? t.label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-all duration-150",
                active
                  ? "bg-[#4a7c59] text-white shadow-sm"
                  : "text-[#7c8091] hover:bg-[#f0ede8] hover:text-[#1a1d23]"
              )}>
              <span className={cn(
                "grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors",
                active ? "bg-white/20" : ""
              )}>
                <Icon size={18} strokeWidth={active ? 2.5 : 2} />
              </span>
              {!collapsed && <span className="text-[13px] font-semibold">{t.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Worker portal link */}
      {!collapsed && (
        <div className="px-3 pb-3">
          <Link href="/portal"
            className="flex items-center gap-3 rounded-2xl border border-[#4a7c59]/20 bg-[#4a7c59]/8 px-3 py-2.5 text-[13px] font-semibold text-[#4a7c59] hover:bg-[#4a7c59]/15 transition-colors">
            <TabletSmartphone size={16} /> Worker Portal
          </Link>
        </div>
      )}

      {/* Live status */}
      <div className="border-t border-black/5 p-3">
        <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold bg-[#4a7c59]/8 text-[#4a7c59]">
          <span className="h-2 w-2 rounded-full bg-[#4a7c59] live-dot" />
          {!collapsed && "All systems live"}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f3f0eb] text-[#1a1d23]">
      {/* Desktop sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 hidden border-r border-black/5 bg-white transition-all duration-300 lg:flex lg:flex-col",
        collapsed ? "w-[76px]" : "w-[260px]"
      )}>
        {sidebarBody}
        <button onClick={() => setCollapsed((c) => !c)}
          className="absolute -right-3 top-20 grid h-7 w-7 place-items-center rounded-full border border-black/10 bg-white text-[#7c8091] shadow-md hover:text-[#1a1d23] transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[280px] bg-white shadow-2xl flex flex-col">{sidebarBody}</aside>
        </div>
      )}

      {/* Main content area */}
      <div className={cn("transition-all duration-300", collapsed ? "lg:pl-[76px]" : "lg:pl-[260px]")}>
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-[#f3f0eb]/80 backdrop-blur-xl border-b border-black/5">
          <div className="mx-auto flex max-w-[1400px] items-center gap-4 px-6 py-4">
            <button onClick={() => setMobileOpen(true)} className="btn-ghost grid h-10 w-10 place-items-center lg:hidden" aria-label="Menu">
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-medium text-[#7c8091]">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#4a7c59] live-dot mr-1.5 align-middle" />
                ADEMCO · live
              </p>
              <h1 className="text-[22px] font-extrabold tracking-tight text-[#1a1d23]">{pageTitle}</h1>
              {pageHint && <p className="hidden truncate text-[13px] text-[#7c8091] sm:block">{pageHint}</p>}
            </div>
            <div className="flex items-center gap-2">
              <button className="relative grid h-10 w-10 place-items-center rounded-xl hover:bg-black/5 transition-colors" title="Notifications">
                <Bell size={18} className="text-[#7c8091]" />
                <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-[#c24a08]" />
              </button>
              <button className="grid h-10 w-10 place-items-center rounded-xl hover:bg-black/5 transition-colors" title="Settings">
                <Settings size={18} className="text-[#7c8091]" />
              </button>
              <UserChip />
            </div>
          </div>
          {/* Mobile tab bar */}
          <nav className="flex gap-1 overflow-x-auto px-4 pb-3 lg:hidden no-scrollbar">
            {TABS.map((t) => {
              const active = isActive(t.href);
              return (
                <Link key={t.href} href={t.href} className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors",
                  active ? "border-[#4a7c59]/30 bg-[#4a7c59]/10 text-[#4a7c59]" : "border-transparent text-[#7c8091] hover:bg-black/5"
                )}>
                  <t.icon size={14} /> {t.label}
                </Link>
              );
            })}
          </nav>
        </header>
        <main className="mx-auto max-w-[1400px] px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
