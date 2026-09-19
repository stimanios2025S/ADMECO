import { createServiceSupabase } from "@/lib/supabase/service";
import PortailClient from "./PortailClient";

export const dynamic = "force-dynamic";

// ═══════════════════════════════════════════════════════════
// PORTAIL CLIENT — la commande par lien à jeton
//
// Le client n'a pas de compte : il reçoit un lien, il ouvre, il
// choisit dans le catalogue, il envoie. Le jeton est la seule clé
// — d'où la lecture par `service_role` côté serveur uniquement,
// et la durée de validité (`token_expire_at`).
//
// ⚠️ Aucune policy `anon` n'est posée sur `commandes_client` : le
//    navigateur du client ne parle jamais directement à la base.
// ═══════════════════════════════════════════════════════════

export default async function CommandePage({ params }: { params: { token: string } }) {
  const token = params.token;
  const sb: any = createServiceSupabase();

  const { data: cmd, error } = await sb
    .from("commandes_client")
    .select("id, numero, client_nom, client_telephone, client_email, client_adresse, note, statut, token_expire_at")
    .eq("token", token)
    .maybeSingle();

  if (error || !cmd) {
    return (
      <Cadre titre="Lien invalide">
        <p className="text-sm text-[#4b4f58]">
          Ce lien de commande n'existe pas. Demandez à ADMEDCO de vous en transmettre un nouveau.
        </p>
      </Cadre>
    );
  }

  if (cmd.token_expire_at && new Date(cmd.token_expire_at).getTime() < Date.now()) {
    return (
      <Cadre titre="Lien expiré">
        <p className="text-sm text-[#4b4f58]">
          Ce lien a expiré. Contactez ADMEDCO au <strong>0555 00 00 00</strong> pour recevoir un nouveau lien de commande.
        </p>
      </Cadre>
    );
  }

  const ferme = cmd.statut !== "BROUILLON" && cmd.statut !== "RECUE";

  const [lignes, articles] = await Promise.all([
    sb
      .from("commande_client_lignes")
      .select("article_id, designation, quantite, prix_unitaire")
      .eq("commande_id", cmd.id)
      .order("ligne_ordre"),
    sb
      .from("erp_articles")
      .select("id, code, designation, unite, prix_vente, est_fabrique, est_semi_fini")
      .or("est_fabrique.eq.true,est_semi_fini.eq.true")
      .order("code")
      .limit(800),
  ]);

  return (
    <PortailClient
      token={token}
      numero={cmd.numero}
      statut={cmd.statut}
      ferme={ferme}
      client={{
        nom: cmd.client_nom ?? "",
        telephone: cmd.client_telephone ?? "",
        email: cmd.client_email ?? "",
        adresse: cmd.client_adresse ?? "",
        note: cmd.note ?? "",
      }}
      lignesInitiales={(lignes.data ?? []).map((l: any) => ({
        articleId: l.article_id ?? null,
        designation: l.designation ?? "",
        quantite: Number(l.quantite) || 0,
        prixUnitaire: Number(l.prix_unitaire) || 0,
      }))}
      catalogue={(articles.data ?? []).map((a: any) => ({
        id: a.id,
        code: a.code ?? "",
        designation: a.designation ?? "",
        unite: a.unite ?? "pcs",
        prix: Number(a.prix_vente) || 0,
      }))}
    />
  );
}

function Cadre({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <div className="card space-y-3 p-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#7c8091]">ADMEDCO · MOBILIX</p>
        <h1 className="text-xl font-extrabold">{titre}</h1>
        {children}
      </div>
    </main>
  );
}
