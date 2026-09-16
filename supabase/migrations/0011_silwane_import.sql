-- ═══════════════════════════════════════════
-- MIGRATION 0011 : IMPORT SILWANE — NOMENCLATURES + CHAMPS RÉELS
-- Source : exports CSV "ADMEDCO REEL" (E:\Massiexporte)
--   COM_Item (767) → erp_articles | COM_ThirdParty (459) → erp_tiers
--   COM_ItemFamily (17) → erp_familles | COM_Batch (706) → erp_lots
--   COM_Formula (257) + COM_BOM (5057) → erp_nomenclatures (NOUVEAU)
-- À exécuter APRÈS 0010 dans Supabase SQL Editor, AVANT le script
-- scripts/import-silwane.mjs — ré-exécutable, idempotent (upsert sil_oid)
-- ═══════════════════════════════════════════

-- ── 1. Champs réels Silwane sur erp_articles ──
ALTER TABLE erp_articles ADD COLUMN IF NOT EXISTS est_fabrique BOOLEAN DEFAULT false;
ALTER TABLE erp_articles ADD COLUMN IF NOT EXISTS sil_type TEXT DEFAULT '';
ALTER TABLE erp_articles ADD COLUMN IF NOT EXISTS tva TEXT DEFAULT '';

-- ── 2. NOMENCLATURES (COM_Formula + COM_BOM : 1 ligne = 1 composant) ──
-- Recette : article fabriqué (article_id) = quantite × composant (composant_id)
CREATE TABLE IF NOT EXISTS erp_nomenclatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sil_oid TEXT UNIQUE,
  code_formule TEXT NOT NULL DEFAULT '',
  formule_sil_oid TEXT DEFAULT '',
  article_id UUID REFERENCES erp_articles(id),
  composant_id UUID REFERENCES erp_articles(id),
  quantite NUMERIC DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nomen_article ON erp_nomenclatures(article_id);
CREATE INDEX IF NOT EXISTS idx_nomen_composant ON erp_nomenclatures(composant_id);
CREATE INDEX IF NOT EXISTS idx_nomen_sil ON erp_nomenclatures(sil_oid);

-- ── 3. RLS : lecture authentifiée, écriture admin (même règle que 0009) ──
ALTER TABLE erp_nomenclatures ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth read all" ON erp_nomenclatures;
CREATE POLICY "auth read all" ON erp_nomenclatures FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "admin write all" ON erp_nomenclatures;
CREATE POLICY "admin write all" ON erp_nomenclatures FOR ALL TO authenticated
  USING (exists(select 1 from profiles p where p.id = auth.uid() and p.role = 'ADMIN'))
  WITH CHECK (exists(select 1 from profiles p where p.id = auth.uid() and p.role = 'ADMIN'));

-- ── 4. VUE : nomenclature lisible (produit fini + composant + quantité) ──
CREATE OR REPLACE VIEW v_erp_nomenclature_detail AS
SELECT n.id, n.sil_oid, n.code_formule, n.quantite,
  pf.id AS pf_id, pf.code AS pf_code, pf.designation AS pf_designation,
  c.id AS comp_id, c.code AS comp_code, c.designation AS comp_designation,
  c.unite AS comp_unite, c.prix_achat AS comp_prix_achat
FROM erp_nomenclatures n
JOIN erp_articles pf ON pf.id = n.article_id
JOIN erp_articles c ON c.id = n.composant_id;

-- ── 5. VUE : coût matière estimé par produit fabriqué ──
CREATE OR REPLACE VIEW v_erp_cout_nomenclature AS
SELECT pf_id, pf_code, pf_designation,
  COUNT(*) AS nb_composants,
  COALESCE(SUM(quantite * COALESCE(comp_prix_achat, 0)), 0) AS cout_matiere_estime
FROM v_erp_nomenclature_detail
GROUP BY pf_id, pf_code, pf_designation;
