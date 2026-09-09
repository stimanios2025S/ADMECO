import "./globals.css";
import type { Metadata, Viewport } from "next";
import SWRegister from "./SWRegister";

export const metadata: Metadata = {
  title: "ADMEDCO MES — Système d'exécution de production",
  description: "MES temps réel pour la production de meubles multi-ateliers",
  manifest: "/manifest.webmanifest"
};
export const viewport: Viewport = { themeColor: "#4a7c59", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-ink text-zinc-100 antialiased">
        <SWRegister />
        {children}
      </body>
    </html>
  );
}
