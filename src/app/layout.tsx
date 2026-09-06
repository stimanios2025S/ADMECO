import "./globals.css";
import type { Metadata, Viewport } from "next";
import SWRegister from "./SWRegister";

export const metadata: Metadata = {
  title: "Furniture MES — Factory Execution System",
  description: "Real-time MES/ERP for multi-site furniture production",
  manifest: "/manifest.webmanifest"
};
export const viewport: Viewport = { themeColor: "#111111", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0c0d10] text-white antialiased">
        <SWRegister />
        <nav className="sticky top-0 z-50 border-b border-zinc-800 bg-black/80 backdrop-blur">
          <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-4">
            <span className="text-xl font-black">🪑 <span className="text-yellow-400">FurnitureMES</span></span>
            <a href="/dashboard" className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm font-bold hover:bg-zinc-700">📊 Dashboard</a>
            <a href="/templates" className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm font-bold hover:bg-zinc-700">🧩 Templates</a>
            <a href="/portal" className="rounded-lg bg-yellow-400 px-3 py-1.5 text-sm font-black text-black">📱 Worker Portal</a>
          </div>
        </nav>
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
