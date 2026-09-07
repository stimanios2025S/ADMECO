import PortalClient from "./PortalClient";
export const dynamic = "force-dynamic";
export default function PortalPage() {
  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <h1 className="text-3xl font-black">📱 Worker Portal — ADEMCO</h1>
      <PortalClient />
    </div>
  );
}
