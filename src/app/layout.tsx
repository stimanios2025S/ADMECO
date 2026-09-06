import "./globals.css";
import type { Metadata, Viewport } from "next";
import SWRegister from "./SWRegister";

export const metadata: Metadata = {
  title: "ADMECO MES — Factory Execution System",
  description: "Real-time MES/ERP for multi-site furniture production",
  manifest: "/manifest.webmanifest"
};
export const viewport: Viewport = { themeColor: "#07080b", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-ink text-zinc-100 antialiased">
        <SWRegister />
        {children}
      </body>
    </html>
  );
}
