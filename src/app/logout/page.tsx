"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LogoutPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<"signing-out" | "done">("signing-out");

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
      setPhase("done");
      setTimeout(() => router.push("/login"), 1200);
    })();
  }, [router]);

  return (
    <div className="min-h-screen bg-[#f3f0eb] flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center animate-fade-up">
        <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-3xl bg-[#4a7c59]/10 text-[#4a7c59]">
          {phase === "signing-out" ? <Loader2 size={28} className="animate-spin" /> : <LogOut size={28} />}
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#1a1d23]">
          {phase === "signing-out" ? "Déconnexion…" : "À bientôt !"}
        </h1>
        <p className="mt-2 text-[14px] text-[#7c8091]">
          {phase === "signing-out"
            ? "Fermeture de votre session en cours."
            : "Redirection vers la page de connexion…"}
        </p>
      </div>
    </div>
  );
}
