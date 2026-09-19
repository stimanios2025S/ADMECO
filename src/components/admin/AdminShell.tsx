"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Truck, Siren, BookOpen, Package, Factory, Send,
  Warehouse, ClipboardCheck, Building2, Boxes, Handshake, FileText,
  Layers, ListTree, Users, Menu, TabletSmartphone, ChevronLeft,
  ChevronRight, Bell, Settings, Sofa, Hammer
} from "lucide-react";
import { cn } from "@/lib/utils";
import UserChip from "./UserChip";

type Section = { label: string; items: { href: string; label: string; icon: any; badge?: string }[] };

const SECTIONS: Section[] = [
  {
    label: "PILOTAGE",
    items: [
      { href: "/admin", label: "Tableau de bord", icon: LayoutDashboard },
      { href: "/admin/roadmap", label: "Feuille de route", icon: Truck },
      { href: "/admin/incidents", label: "Alertes", icon: Siren },
      { href: "/admin/archives", label: "Archives", icon: BookOpen },
    ]
  },
  {
    label: "PRODUCTION",
    items: [
      { href: "/admin/orders", label: "Commandes", icon: Package },
      { href: "/admin/fabrication", label: "Fabrication", icon: Factory },
      { href: "/admin/suivi-atelier1", label: "Suivi Atelier 1", icon: Hammer },
      { href: "/admin/suivi-mobilix", label: "Suivi MOBILIX", icon: Sofa },
      { href: "/admin/destinations", label: "Destinations", icon: Send },
    ]
  },
  {
    label: "STOCKS",
    items: [
      { href: "/admin/stocks", label: "Stocks", icon: Warehouse },
      { href: "/admin/reception", label: "Réception MP", icon: ClipboardCheck },
      { href: "/admin/depots", label: "Dépôts", icon: Building2 },
    ]
  },
  {
    label: "ERP SILWANE",
    items: [
      { href: "/admin/articles", label: "Articles", icon: Boxes },
      { href: "/admin/tiers", label: "Tiers", icon: Handshake },
      { href: "/admin/documents", label: "Documents", icon: FileText },
      { href: "/admin/lots", label: "Lots", icon: Layers },
      { href: "/admin/nomenclatures", label: "Nomenclatures", icon: ListTree },
    ]
  },
  {
    label: "SUIVI",
    items: [
      { href: "/admin/team", label: "Équipe", icon: Users },
    ]
  }
];

const ROUTES_MAGASINIER = ["/admin/stocks", "/admin/reception", "/admin/depots"];

export default function AdminShell({ children, pageTitle, pageHint }: { children: ReactNode; pageTitle: string; pageHint?: string }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [usine, setUsine] = useState<string | null>(null);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  useEffect(() => {
    fetch("/api/mon-profil")
      .then((res) => (res.ok ? res.json() : null))
      .then((profil) => {
        if (profil) {
          setRole(profil.role ?? null);
          setUsine(profil.usine_code ?? null);
        }
      })
      .catch(() => {});
  }, []);

  const isMagasinier = role === "MAGASINIER";

  const visibleSections: Section[] = isMagasinier
    ? SECTIONS.map((s) => ({
        ...s,
        items: s.items.filter((item) => ROUTES_MAGASINIER.includes(item.href)),
      })).filter((s) => s.items.length > 0)
    : SECTIONS;

  const FLAT_TABS = visibleSections.flatMap((s) => s.items);

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  };

  const badgeColor = usine === "MOBILIX" ? "#7c3aed" : "#4a7c59";

  const sidebarBody = (
    <div className="flex h-full flex-col bg-[#fafbf9]">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 pt-7 pb-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#4a7c59] text-xl font-black text-white shadow-md shadow-[#4a7c59]/20">
          🪑
        </div>
        {!collapsed && (
          <div>
            <p className="text-[16px] font-extrabold tracking-tight text-[#1a1d23]">ADMEDCO <span className="text-[#4a7c59]">MES</span></p>
            <p className="text-[10px] font-medium text-[#9ca3af]">Centre de commande usine</p>
          </div>
        )}
      </div>

      {/* Badge usine */}
      {!collapsed ? (
        usine && (
          <div className="px-5 pb-4">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-white"
              style={{ backgroundColor: badgeColor }}>
              <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
              {usine}
            </span>
          </div>
        )
      ) : (
        usine && (
          <div className="flex justify-center pb-3">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: badgeColor }}
              title={usine}
            />
          </div>
        )
      )}

      {/* Sections nav */}
      <nav className="flex-1 overflow-y-auto px-3 space-y-5">
        {visibleSections.map((section) => (
          <div key={section.label}>
            {!collapsed && (
              <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#b0b5bf]">
                {section.label}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((t) => {
                const active = isActive(t.href);
                const Icon = t.icon;
                return (
                  <Link key={t.href} href={t.href} title={collapsed ? t.label : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-150 text-[13px] font-medium",
                      active
                        ? "bg-[#4a7c59] text-white shadow-sm shadow-[#4a7c59]/20 font-semibold"
                        : "text-[#6b7280] hover:bg-[#4a7c59]/[0.06] hover:text-[#1a1d23]"
                    )}>
                    <span className={cn(
                      "grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors",
                      active ? "bg-white/20" : ""
                    )}>
                      <Icon size={17} strokeWidth={active ? 2.4 : 1.8} />
                    </span>
                    {!collapsed && <span>{t.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom links */}
      <div className="border-t border-black/[0.04] px-3 py-3 space-y-0.5">
        {!collapsed && (
          <Link href="/portal"
            className="flex items-center gap-3 rounded-xl border border-[#4a7c59]/15 bg-[#4a7c59]/[0.04] px-3 py-2.5 text-[13px] font-medium text-[#4a7c59] hover:bg-[#4a7c59]/[0.08] transition-colors">
            <TabletSmartphone size={16} /> Portail ateliers
          </Link>
        )}
        <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-[#9ca3af]">
          <span className="h-2 w-2 rounded-full bg-[#4a7c59] live-dot" />
          {!collapsed && "Système en ligne"}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f5f6f2] text-[#1a1d23]">
      {/* Desktop sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 hidden border-r border-black/[0.04] bg-[#fafbf9] transition-all duration-300 lg:flex lg:flex-col",
        collapsed ? "w-[72px]" : "w-[256px]"
      )}>
        {sidebarBody}
        <button onClick={() => setCollapsed((c) => !c)}
          className="absolute -right-3 top-24 grid h-6 w-6 place-items-center rounded-full border border-black/10 bg-white text-[#9ca3af] shadow-md hover:text-[#1a1d23] transition-colors"
          title={collapsed ? "Déplier" : "Replier"}>
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[280px] bg-[#fafbf9] shadow-2xl flex flex-col">{sidebarBody}</aside>
        </div>
      )}

      {/* Main content area */}
      <div className={cn("transition-all duration-300", collapsed ? "lg:pl-[72px]" : "lg:pl-[256px]")}>
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-[#f5f6f2]/80 backdrop-blur-xl border-b border-black/[0.04]">
          <div className="mx-auto flex max-w-[1440px] items-center gap-4 px-6 py-4">
            <button onClick={() => setMobileOpen(true)} className="grid h-10 w-10 place-items-center rounded-xl hover:bg-black/[0.04] lg:hidden" aria-label="Menu">
              <Menu size={18} className="text-[#6b7280]" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="text-[22px] font-extrabold tracking-tight text-[#1a1d23]">{pageTitle}</h1>
              {pageHint && <p className="hidden truncate text-[13px] text-[#9ca3af] sm:block">{pageHint}</p>}
            </div>
            <div className="flex items-center gap-2">
              <button className="relative grid h-10 w-10 place-items-center rounded-xl hover:bg-black/[0.04] transition-colors" title="Notifications">
                <Bell size={18} className="text-[#6b7280]" />
                <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-[#c24a08]" />
              </button>
              <button className="grid h-10 w-10 place-items-center rounded-xl hover:bg-black/[0.04] transition-colors" title="Réglages">
                <Settings size={18} className="text-[#6b7280]" />
              </button>
              <UserChip />
            </div>
          </div>
          {/* Mobile tab bar */}
          <nav className="flex gap-1 overflow-x-auto px-4 pb-3 lg:hidden no-scrollbar">
            {FLAT_TABS.map((t) => {
              const active = isActive(t.href);
              return (
                <Link key={t.href} href={t.href} className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition-colors",
                  active ? "border-[#4a7c59]/30 bg-[#4a7c59]/10 text-[#4a7c59]" : "border-transparent text-[#9ca3af] hover:bg-black/[0.04]"
                )}>
                  <t.icon size={13} /> {t.label}
                </Link>
              );
            })}
          </nav>
        </header>
        <main className="mx-auto max-w-[1440px] px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
