export default function Home() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 py-16 text-center">
      <div className="text-6xl">🪑</div>
      <h1 className="text-4xl font-black">
        Furniture<span className="text-yellow-400">MES</span>
      </h1>
      <p className="text-zinc-400">
        Real-time Manufacturing Execution System for multi-site furniture production.
      </p>
      <div className="flex justify-center gap-3">
        <a href="/dashboard" className="rounded-xl bg-yellow-400 px-6 py-3 font-black text-black">
          📊 Admin Dashboard
        </a>
        <a href="/portal" className="rounded-xl bg-zinc-800 px-6 py-3 font-bold hover:bg-zinc-700">
          📱 Worker Portal
        </a>
      </div>
    </div>
  );
}
