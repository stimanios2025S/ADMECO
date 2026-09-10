"use server";
import { createServerSupabase } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ─── ERP ADMEDCO : actions génériques (fini la démo) ───
// Chaque table erp_* a sa page /admin/* : articles, tiers, documents,
// fabrication, lots, inventaires, machines, employés, écritures, dépôts.

async function insertErp(table: string, payload: Record<string, any>, paths: string[]) {
  const supabase = createServerSupabase();
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (v === "" || v == null) continue;
    clean[k] = v;
  }
  const { error } = await supabase.from(table).insert(clean);
  if (error) throw new Error(error.message);
  for (const p of paths) revalidatePath(p);
}

export async function ajouterArticle(fd: FormData) {
  await insertErp("erp_articles", {
    code: String(fd.get("code") ?? ""),
    designation: String(fd.get("designation") ?? ""),
    famille_id: String(fd.get("famille_id") ?? "") || null,
    unite: String(fd.get("unite") ?? "pcs"),
    prix_achat: Number(fd.get("prix_achat") ?? 0),
    prix_vente: Number(fd.get("prix_vente") ?? 0),
    stock_logique: Number(fd.get("stock_logique") ?? 0),
    stock_min: Number(fd.get("stock_min") ?? 0),
    stock_max: Number(fd.get("stock_max") ?? 0),
    code_barres: String(fd.get("code_barres") ?? ""),
  }, ["/admin/articles", "/admin/stocks"]);
}

export async function ajouterTiers(fd: FormData) {
  await insertErp("erp_tiers", {
    code: String(fd.get("code") ?? ""),
    raison_sociale: String(fd.get("raison_sociale") ?? ""),
    type_tiers: String(fd.get("type_tiers") ?? "client"),
    telephone: String(fd.get("telephone") ?? ""),
    adresse: String(fd.get("adresse") ?? ""),
    wilaya: String(fd.get("wilaya") ?? ""),
    nif: String(fd.get("nif") ?? ""),
  }, ["/admin/tiers", "/admin/documents"]);
}

export async function ajouterDocument(fd: FormData) {
  await insertErp("erp_documents", {
    numero: String(fd.get("numero") ?? ""),
    type_doc: String(fd.get("type_doc") ?? "facture"),
    tiers_id: String(fd.get("tiers_id") ?? "") || null,
    date_doc: String(fd.get("date_doc") ?? "") || null,
    total_ht: Number(fd.get("total_ht") ?? 0),
    total_ttc: Number(fd.get("total_ttc") ?? 0),
  }, ["/admin/documents"]);
}

export async function ajouterFabrication(fd: FormData) {
  await insertErp("erp_fabrication", {
    numero: String(fd.get("numero") ?? ""),
    article_id: String(fd.get("article_id") ?? "") || null,
    atelier_id: Number(fd.get("atelier_id") ?? 1),
    quantite_prevue: Number(fd.get("quantite_prevue") ?? 0),
    date_debut: String(fd.get("date_debut") ?? "") || null,
    date_fin: String(fd.get("date_fin") ?? "") || null,
  }, ["/admin/fabrication", "/admin"]);
}

export async function ajouterLot(fd: FormData) {
  await insertErp("erp_lots", {
    numero_lot: String(fd.get("numero_lot") ?? ""),
    article_id: String(fd.get("article_id") ?? "") || null,
    depot_id: String(fd.get("depot_id") ?? "") || null,
    quantite: Number(fd.get("quantite") ?? 0),
    date_expiration: String(fd.get("date_expiration") ?? "") || null,
  }, ["/admin/lots"]);
}

export async function ajouterInventaire(fd: FormData) {
  await insertErp("erp_inventaires", {
    depot_id: String(fd.get("depot_id") ?? "") || null,
    article_id: String(fd.get("article_id") ?? "") || null,
    quantite_theorique: Number(fd.get("quantite_theorique") ?? 0),
    quantite_comptee: Number(fd.get("quantite_comptee") ?? 0),
    date_inventaire: String(fd.get("date_inventaire") ?? "") || null,
  }, ["/admin/inventaires", "/admin/stocks"]);
}

export async function ajouterMachine(fd: FormData) {
  await insertErp("erp_machines", {
    code: String(fd.get("code") ?? ""),
    nom: String(fd.get("nom") ?? ""),
    famille: String(fd.get("famille") ?? ""),
    atelier_id: Number(fd.get("atelier_id") ?? 1),
  }, ["/admin/machines"]);
}

export async function ajouterEmploye(fd: FormData) {
  await insertErp("erp_employes", {
    matricule: String(fd.get("matricule") ?? ""),
    nom: String(fd.get("nom") ?? ""),
    prenom: String(fd.get("prenom") ?? ""),
    poste: String(fd.get("poste") ?? ""),
    atelier_id: Number(fd.get("atelier_id") ?? 1),
    date_embauche: String(fd.get("date_embauche") ?? "") || null,
  }, ["/admin/employes", "/admin/team"]);
}

export async function ajouterEcriture(fd: FormData) {
  await insertErp("erp_ecritures", {
    numero: String(fd.get("numero") ?? ""),
    journal: String(fd.get("journal") ?? ""),
    date_ecriture: String(fd.get("date_ecriture") ?? "") || null,
    compte: String(fd.get("compte") ?? ""),
    libelle: String(fd.get("libelle") ?? ""),
    debit: Number(fd.get("debit") ?? 0),
    credit: Number(fd.get("credit") ?? 0),
  }, ["/admin/ecritures"]);
}

export async function ajouterDepot(fd: FormData) {
  await insertErp("erp_depots", {
    code: String(fd.get("code") ?? ""),
    nom: String(fd.get("nom") ?? ""),
    atelier_id: Number(fd.get("atelier_id") ?? 1),
    adresse: String(fd.get("adresse") ?? ""),
  }, ["/admin/depots", "/admin/stocks"]);
}
