"use client";
import { useState } from "react";
import { ScanText, CheckCircle2, Pencil, Trash2, Upload, FileText } from "lucide-react";
import { GlassCard, SectionTitle, StatusPill, Empty } from "@/components/admin/ui";
import { proposerReceptionMP, confirmerReceptionMP } from "@/app/actions-usines";
import { classerFamille } from "@/lib/agents/reception";
import { cn } from "@/lib/utils";

type Props = { usine: string; historique: any[] };

type Ligne = { designation: string; quantite: number; prixUnitaire: number; famille: string };

export default function ReceptionClient({ usine, historique }: Props) {
  const [texte, setTexte] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [receptionId, setReceptionId] = useState<string | null>(null);
  const [fournisseur, setFournisseur] = useState<string>("");
  const [lignes, setLignes] = useState<Ligne[]>([]);

  const analyser = async () => {
    setBusy(true);
    setMsg(null);
    const r = await proposerReceptionMP(usine, texte);
    setBusy(false);
    setMsg({ ok: r.ok, text: r.message });
    if (r.ok) {
      setReceptionId(r.receptionId ?? null);
      setFournisseur(r.fournisseurNom ?? "");
      setLignes(((r.lignes ?? []) as any[]).map((l: any) => ({
        designation: String(l.designation ?? ""),
        quantite: Number(l.quantite) || 0,
        prixUnitaire: Number(l.prixUnitaire) || 0,
        famille: l.famille ?? classerFamille(String(l.designation ?? ""))
      })));
    }
  };

  const chargerFichier = async (f: File | undefined) => {
    if (!f) return;
    const content = await f.text();
    setTexte(content);
  };

  const majLigne = (idx: number, patch: Partial<Ligne>) => {
    setLignes((ls) => ls.map((l, i) => {
      if (i !== idx) return l;
      const next = { ...l, ...patch };
      if (patch.designation !== undefined) next.famille = classerFamille(patch.designation);
      return next;
    }));
  };

  const confirmer = async () => {
    if (!receptionId) return;
    setBusy(true);
    const r = await confirmerReceptionMP(receptionId, lignes);
    setBusy(false);
    setMsg({ ok: r.ok, text: r.message });
    if (r.ok) {
      setTexte("");
      setLignes([]);
      setReceptionId(null);
      setFournisseur("");
      window.location.reload();
    }
  };

  return (
    <div className="stagger space-y-5">
      {msg && (
        <div className={cn("rounded-xl border px-4 py-2.5 text-[13px] font-semibold",
          msg.ok ? "border-[#4a7c59]/30 bg-[#4a7c59]/[0.06] text-[#4a7c59]" : "border-red-200 bg-red-50 text-red-600")}>
          {msg.text}
        </div>
      )}

      <GlassCard>
        <SectionTitle kicker="Magasinier" title="Coller la facture fournisseur"
          hint="Texte copié depuis le PDF / e-mail, ou fichier .txt / .csv lu côté navigateur." />
        <textarea value={texte} onChange={(e) => setTexte(e.target.value)}
          rows={7}
          placeholder={"Exemple :\nFournisseur : BOIS ATLAS\nFacture : FA-2024-118\nPlanche chêne;120;85\nVis inox;5000;0.4"}
          className="input w-full px-4 py-3 font-mono text-[12px]" />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-black/10 px-4 py-2.5 text-[13px] font-bold text-[#6b7280] hover:bg-black/[0.03]">
            <Upload size={15} /> Importer .txt / .csv
            <input type="file" accept=".txt,.csv" className="hidden"
              onChange={(e) => chargerFichier(e.target.files?.[0])} />
          </label>
          <button disabled={busy || !texte.trim()} onClick={analyser}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#4a7c59] px-5 py-2.5 text-[13px] font-bold text-white hover:bg-[#3a6b48] disabled:opacity-50">
            <ScanText size={15} /> {busy ? "Analyse…" : "Analyser"}
          </button>
          {fournisseur && <span className="text-[12px] font-semibold text-[#7c8091]">Fournisseur détecté : <b className="text-[#1a1d23]">{fournisseur}</b></span>}
        </div>
      </GlassCard>

      {lignes.length > 0 && (
        <GlassCard>
          <SectionTitle kicker="Vérification" title={`${lignes.length} ligne(s) à vérifier`}
            hint="Modifiez désignation, quantité, prix — la famille est détectée automatiquement."
            right={
              <button disabled={busy || !receptionId} onClick={confirmer}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#4a7c59] px-5 py-2.5 text-[13px] font-bold text-white hover:bg-[#3a6b48] disabled:opacity-50">
                <CheckCircle2 size={15} /> {busy ? "…" : "Confirmer l'entrée en stock"}
              </button>
            } />
          <div className="space-y-2">
            {lignes.map((l, i) => (
              <div key={i} className="card grid gap-2 p-3 md:grid-cols-[1fr_110px_110px_150px_36px]">
                <input value={l.designation} onChange={(e) => majLigne(i, { designation: e.target.value })}
                  className="input px-3 py-2 text-[13px] font-semibold" placeholder="Désignation" />
                <input type="number" step="any" min={0} value={l.quantite}
                  onChange={(e) => majLigne(i, { quantite: Number(e.target.value) })}
                  className="input px-3 py-2 text-[13px]" placeholder="Qté" title="Quantité" />
                <input type="number" step="any" min={0} value={l.prixUnitaire}
                  onChange={(e) => majLigne(i, { prixUnitaire: Number(e.target.value) })}
                  className="input px-3 py-2 text-[13px]" placeholder="Prix unit." title="Prix unitaire" />
                <span className="inline-flex items-center gap-1 rounded-xl bg-[#4a7c59]/10 px-3 py-2 text-[12px] font-bold text-[#4a7c59]">
                  <Pencil size={12} /> {l.famille}
                </span>
                <button onClick={() => setLignes((ls) => ls.filter((_, j) => j !== i))}
                  className="grid h-9 w-9 place-items-center rounded-xl border border-red-200 bg-red-50 text-red-500" title="Retirer">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      <GlassCard>
        <SectionTitle kicker="Historique" title="Réceptions" hint={`Usine ${usine} — proposées puis confirmées.`} />
        {historique.length === 0 ? (
          <Empty icon="🧾" title="Aucune réception" hint="Collez une facture ci-dessus pour commencer." />
        ) : (
          <div className="space-y-2">
            {historique.map((r: any) => (
              <div key={r.id} className="card flex items-center gap-3 p-3.5">
                <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl",
                  r.statut === "CONFIRMEE" ? "bg-[#4a7c59]/10 text-[#4a7c59]" : "bg-amber-50 text-amber-600")}>
                  <FileText size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold">{r.fournisseurs?.nom ?? "Fournisseur"} · {r.numero_facture || "sans n°"}</p>
                  <p className="text-[11px] text-[#7c8091]">{(r.lignes ?? []).length} ligne(s) · {r.created_at ? new Date(r.created_at).toLocaleString("fr-FR") : "—"}</p>
                </div>
                <StatusPill status={r.statut === "CONFIRMEE" ? "VERIFIED" : "PENDING"} />
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
