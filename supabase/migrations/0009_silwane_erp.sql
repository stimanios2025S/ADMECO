-- ═══════════════════════════════════════════
-- MIGRATION 0009 : ERP ADMEDCO personnalisé — recopie concept SILWANE
-- Base source : "ADMEDCO REEL" (silwane_db.backup, PGDMP 9.5.21)
-- Tables miroirs FR : chaque table SILWANE => 1 table erp_* + 1 page /admin/*
-- À exécuter APRÈS 0008 dans Supabase SQL Editor
-- Fini la démo : ces tables sont la structure réelle d'accueil
-- ═══════════════════════════════════════════

-- ── 1. SOCIÉTÉ (STD_Company) ──
CREATE TABLE IF NOT EXISTS erp_societe (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raison_sociale TEXT NOT NULL DEFAULT 'ADMEDCO',
  nif TEXT DEFAULT '',
  adresse TEXT DEFAULT '',
  telephone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);
INSERT INTO erp_societe(raison_sociale) VALUES ('ADMEDCO') ON CONFLICT DO NOTHING;

-- ── 2. DÉPÔTS (COM_Warehouse + STD_Warehouse) → liés aux 2 ateliers ──
CREATE TABLE IF NOT EXISTS erp_depots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  nom TEXT NOT NULL,
  atelier_id SMALLINT REFERENCES ateliers(id),
  adresse TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);
INSERT INTO erp_depots(code, nom, atelier_id) VALUES
('DEP-A1', 'Dépôt Atelier 1 — Bois & Découpe', 1),
('DEP-A2', 'Dépôt Atelier 2 — Assemblage & Finition', 2)
ON CONFLICT (code) DO NOTHING;

-- ── 3. FAMILLES ARTICLES (COM_ItemFamily) ──
CREATE TABLE IF NOT EXISTS erp_familles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  nom TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
INSERT INTO erp_familles(code, nom) VALUES
('FAM-CHA', 'Chaises'),
('FAM-TAB', 'Tables à manger'),
('FAM-ARM', 'Armoires'),
('FAM-FAU', 'Fauteuils'),
('FAM-PME', 'Pieds Métal'),
('FAM-MP', 'Matières premières'),
('FAM-QCA', 'Quincaillerie')
ON CONFLICT (code) DO NOTHING;

-- ── 4. ARTICLES (COM_Item : Oid, Code, Label1, Family, UnitValue, LogicalQuantity, ReservedQuantity, QuantityMin/Max, IsPerishable, Blocked) ──
CREATE TABLE IF NOT EXISTS erp_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sil_oid TEXT UNIQUE,
  code TEXT NOT NULL DEFAULT '',
  designation TEXT NOT NULL,
  famille_id UUID REFERENCES erp_familles(id),
  unite TEXT NOT NULL DEFAULT 'pcs',
  prix_achat NUMERIC DEFAULT 0,
  prix_vente NUMERIC DEFAULT 0,
  stock_logique NUMERIC DEFAULT 0,
  stock_reserve NUMERIC DEFAULT 0,
  stock_min NUMERIC DEFAULT 0,
  stock_max NUMERIC DEFAULT 0,
  perissable BOOLEAN DEFAULT false,
  bloque BOOLEAN DEFAULT false,
  code_barres TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_articles_famille ON erp_articles(famille_id);
CREATE INDEX IF NOT EXISTS idx_articles_code ON erp_articles(code);
CREATE INDEX IF NOT EXISTS idx_articles_sil ON erp_articles(sil_oid);

-- ── 5. TIERS (COM_ThirdParty : clients / fournisseurs) ──
CREATE TABLE IF NOT EXISTS erp_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sil_oid TEXT UNIQUE,
  code TEXT NOT NULL DEFAULT '',
  raison_sociale TEXT NOT NULL,
  type_tiers TEXT NOT NULL DEFAULT 'client' CHECK (type_tiers IN ('client','fournisseur','salarie','autre')),
  telephone TEXT DEFAULT '',
  adresse TEXT DEFAULT '',
  wilaya TEXT DEFAULT '',
  nif TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tiers_type ON erp_tiers(type_tiers);

-- ── 6. DOCUMENTS (COM_Document + COM_DocumentDetail : devis, commandes, factures, bons) ──
CREATE TABLE IF NOT EXISTS erp_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sil_oid TEXT UNIQUE,
  numero TEXT UNIQUE NOT NULL,
  type_doc TEXT NOT NULL DEFAULT 'facture' CHECK (type_doc IN ('devis','commande_client','commande_fournisseur','facture','bon_livraison','bon_reception','avoir')),
  tiers_id UUID REFERENCES erp_tiers(id),
  date_doc DATE DEFAULT CURRENT_DATE,
  total_ht NUMERIC DEFAULT 0,
  total_ttc NUMERIC DEFAULT 0,
  statut TEXT DEFAULT 'brouillon' CHECK (statut IN ('brouillon','valide','solde','annule')),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS erp_document_lignes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES erp_documents(id) ON DELETE CASCADE,
  article_id UUID REFERENCES erp_articles(id),
  designation TEXT NOT NULL DEFAULT '',
  quantite NUMERIC NOT NULL DEFAULT 1,
  prix_unitaire NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_doclignes_doc ON erp_document_lignes(document_id);

-- ── 7. LOTS & SÉRIES (COM_Batch + COM_SerialNumber + COM_BatchWarehouse) ──
CREATE TABLE IF NOT EXISTS erp_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sil_oid TEXT UNIQUE,
  article_id UUID REFERENCES erp_articles(id),
  depot_id UUID REFERENCES erp_depots(id),
  numero_lot TEXT NOT NULL DEFAULT '',
  quantite NUMERIC DEFAULT 0,
  date_expiration DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── 8. FABRICATION (Prod_Production + Prod_ProductionDetail + Prod_ProductionState) ──
CREATE TABLE IF NOT EXISTS erp_fabrication (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sil_oid TEXT UNIQUE,
  numero TEXT UNIQUE NOT NULL,
  article_id UUID REFERENCES erp_articles(id),
  quantite_prevue NUMERIC DEFAULT 0,
  quantite_bonne NUMERIC DEFAULT 0,
  quantite_rebut NUMERIC DEFAULT 0,
  statut TEXT DEFAULT 'en_cours' CHECK (statut IN ('en_cours','termine','annule','suspendu')),
  atelier_id SMALLINT REFERENCES ateliers(id),
  date_debut DATE DEFAULT CURRENT_DATE,
  date_fin DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── 9. MACHINES (Prod_Machine + Prod_MachineFamily + Prod_Counter) ──
CREATE TABLE IF NOT EXISTS erp_machines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  nom TEXT NOT NULL,
  famille TEXT DEFAULT '',
  atelier_id SMALLINT REFERENCES ateliers(id),
  statut TEXT DEFAULT 'active' CHECK (statut IN ('active','panne','maintenance','arret')),
  created_at TIMESTAMPTZ DEFAULT now()
);
INSERT INTO erp_machines(code, nom, famille, atelier_id) VALUES
('SCIE-01', 'Scie à panneaux', 'Découpe', 1),
('CNC-01', 'CNC précision', 'Usinage', 1),
('SOUD-01', 'Poste soudure MIG', 'Soudage', 2),
('POUD-01', 'Cabine poudrage', 'Finition', 2)
ON CONFLICT (code) DO NOTHING;

-- ── 10. EMPLOYÉS (HRM_Employee + HRM_Contract + HRM_Job) ──
CREATE TABLE IF NOT EXISTS erp_employes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matricule TEXT UNIQUE NOT NULL,
  nom TEXT NOT NULL,
  prenom TEXT DEFAULT '',
  poste TEXT DEFAULT '',
  atelier_id SMALLINT REFERENCES ateliers(id),
  date_embauche DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── 11. ÉCRITURES (ACC_Operation + ACC_OperationDetail + ACC_Account) ──
CREATE TABLE IF NOT EXISTS erp_ecritures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL DEFAULT '',
  journal TEXT DEFAULT '',
  date_ecriture DATE DEFAULT CURRENT_DATE,
  compte TEXT DEFAULT '',
  libelle TEXT DEFAULT '',
  debit NUMERIC DEFAULT 0,
  credit NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── 12. INVENTAIRES (COM_Inventory) ──
CREATE TABLE IF NOT EXISTS erp_inventaires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  depot_id UUID REFERENCES erp_depots(id),
  article_id UUID REFERENCES erp_articles(id),
  quantite_theorique NUMERIC DEFAULT 0,
  quantite_comptee NUMERIC DEFAULT 0,
  date_inventaire DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════
-- RLS : lecture authentifiée, écriture admin
-- ═══════════════════════════════════════════
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['erp_societe','erp_depots','erp_familles','erp_articles','erp_tiers','erp_documents','erp_document_lignes','erp_lots','erp_fabrication','erp_machines','erp_employes','erp_ecritures','erp_inventaires']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "auth read all" ON %I', t);
    EXECUTE format('CREATE POLICY "auth read all" ON %I FOR SELECT TO authenticated USING (true)', t);
    EXECUTE format('DROP POLICY IF EXISTS "admin write all" ON %I', t);
    EXECUTE format('CREATE POLICY "admin write all" ON %I FOR ALL TO authenticated USING (exists(select 1 from profiles p where p.id = auth.uid() and p.role = %L)) WITH CHECK (exists(select 1 from profiles p where p.id = auth.uid() and p.role = %L))', t, 'ADMIN', 'ADMIN');
  END LOOP;
END $$;

-- ═══════════════════════════════════════════
-- VUE : stock temps réel depuis erp_articles (remplace les 19 démos)
-- ═══════════════════════════════════════════
CREATE OR REPLACE VIEW v_erp_stock AS
SELECT a.id, a.code, a.designation AS name, a.unite AS unit,
  a.stock_logique AS quantity, a.stock_min AS alert_threshold,
  a.stock_reserve AS reserved,
  (a.stock_logique - a.stock_reserve) AS available,
  (a.stock_logique <= a.stock_min) AS low_stock,
  f.nom AS famille
FROM erp_articles a LEFT JOIN erp_familles f ON f.id = a.famille_id
WHERE a.bloque = false;
