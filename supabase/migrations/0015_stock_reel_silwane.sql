-- ═══════════════════════════════════════════════════════════
-- MIGRATION 0015 : STOCK RÉEL SILWANE — FIN DE LA DÉMO
-- Source : exports E:\Massiexporte (ADMEDCO REEL)
--   706 articles · 17 familles · 343 tiers · 706 lots
--   244 nomenclatures · 5057 lignes BOM
--
-- OBJECTIF : relier le catalogue ERP réel (erp_articles) au stock
-- vivant du MES (stock_items), et supprimer les 19 articles de démo
-- semés par 0006 et 0007.
--
-- À exécuter APRÈS 0014. Ré-exécutable, idempotent.
-- ═══════════════════════════════════════════════════════════

-- ── 1. MOUVEMENTS : autoriser les types réels manquants ──
-- 0005 n'autorisait que ('reserve','consume','release','adjust').
-- L'entrée en stock produit fini (ECO étape 7) écrit 'produce' : sans
-- cette correction le mouvement est rejeté par le CHECK et perdu.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'stock_movements'::regclass
      AND conname = 'stock_movements_movement_type_check'
  ) THEN
    ALTER TABLE stock_movements DROP CONSTRAINT stock_movements_movement_type_check;
  END IF;
  ALTER TABLE stock_movements
    ADD CONSTRAINT stock_movements_movement_type_check
    CHECK (movement_type IN (
      'reserve','consume','release','adjust',
      'produce',      -- entrée produit fini (étape stock PF)
      'receipt',      -- réception fournisseur / magasinier
      'transfer_out','transfer_in', -- transfert ADMEDCO → MOBILIX
      'scrap'         -- mise au rebut
    ));
END $$;

-- ── 2. erp_articles : champs réels Silwane manquants ──
ALTER TABLE erp_articles ADD COLUMN IF NOT EXISTS est_mp         BOOLEAN DEFAULT false; -- IsRawMaterial
ALTER TABLE erp_articles ADD COLUMN IF NOT EXISTS est_semi_fini  BOOLEAN DEFAULT false; -- IsSemiFinished
ALTER TABLE erp_articles ADD COLUMN IF NOT EXISTS stock_physique NUMERIC DEFAULT 0;     -- PhysicalQuantity
ALTER TABLE erp_articles ADD COLUMN IF NOT EXISTS reference      TEXT DEFAULT '';
ALTER TABLE erp_articles ADD COLUMN IF NOT EXISTS emplacement    TEXT DEFAULT '';

-- Recherche rapide par code article (0 doublon constaté dans l'export)
CREATE UNIQUE INDEX IF NOT EXISTS uq_erp_articles_code ON erp_articles(code) WHERE code <> '';

-- ── 3. stock_items : rattacher chaque ligne au catalogue réel ──
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS article_id    UUID REFERENCES erp_articles(id);
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS code          TEXT;              -- code article Silwane
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS prix_unitaire NUMERIC DEFAULT 0; -- VWAP
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS famille_nom   TEXT DEFAULT '';
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS is_demo       BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_stock_article ON stock_items(article_id);
-- Idempotence de l'import : un article = une ligne par dépôt et par usine
CREATE UNIQUE INDEX IF NOT EXISTS uq_stock_code_depot
  ON stock_items(code, depot_code, usine_code) WHERE code IS NOT NULL;

-- ── 4. work_order_items : rattacher la production au produit réel ──
-- La démo passait par product_categories (Chairs, Cabinets…).
-- Les nouvelles commandes visent un article Silwane identifié.
ALTER TABLE work_order_items ADD COLUMN IF NOT EXISTS article_id UUID REFERENCES erp_articles(id);
CREATE INDEX IF NOT EXISTS idx_items_article ON work_order_items(article_id);

-- ── 5. FIN DE LA DÉMO ──
-- Les 19 lignes de stock semées par 0006/0007 n'ont pas de code article.
UPDATE stock_items SET is_demo = true WHERE code IS NULL;

-- Suppression des lignes de démo SANS aucune trace d'exploitation.
-- Toute ligne ayant servi (mouvement, log matière, réservation) est
-- conservée : on ne casse jamais un historique de production.
DELETE FROM stock_items s
WHERE s.is_demo = true
  AND NOT EXISTS (SELECT 1 FROM stock_movements m          WHERE m.stock_item_id = s.id)
  AND NOT EXISTS (SELECT 1 FROM material_logs l            WHERE l.stock_item_id = s.id)
  AND NOT EXISTS (SELECT 1 FROM order_item_reservations r  WHERE r.stock_item_id = s.id);

-- ── 6. VUE : stock réel exploitable (catalogue + dépôt) ──
-- CREATE OR REPLACE (et non DROP + CREATE) : reste rejouable même une fois
-- que l'application consomme la vue. Ajouter les colonnes à la fin.
CREATE OR REPLACE VIEW v_stock_reel AS
SELECT
  s.id,
  s.code,
  COALESCE(a.designation, s.name) AS designation,
  a.reference,
  s.name,
  s.unit,
  s.quantity,
  s.alert_threshold,
  s.depot_code,
  s.usine_code,
  COALESCE(s.prix_unitaire, a.prix_achat, 0) AS prix_unitaire,
  (s.quantity * COALESCE(s.prix_unitaire, a.prix_achat, 0)) AS valeur,
  s.article_id,
  COALESCE(s.famille_nom, f.nom) AS famille,
  a.est_mp,
  a.est_fabrique,
  a.est_semi_fini,
  s.is_demo
FROM stock_items s
LEFT JOIN erp_articles  a ON a.id = s.article_id
LEFT JOIN erp_familles  f ON f.id = a.famille_id;

-- ── 6b. VUE v_stock_status enrichie (remplace la version de 0010) ──
-- Expose le code article, la famille, le prix et le drapeau démo pour que
-- les pages admin filtrent le stock réel. Corrige aussi `low_stock` :
-- l'import réel renseigne alert_threshold avec QuantityMin, souvent 0 ;
-- sans le test `> 0`, tout article à seuil nul serait signalé « stock bas ».
--
-- ⚠️ CREATE OR REPLACE VIEW n'accepte de nouvelles colonnes QU'À LA FIN :
-- les 9 colonnes d'origine sont donc reprises dans leur ordre exact, puis
-- les colonnes ajoutées sont appendues. Les insérer au milieu ferait
-- échouer la migration (« cannot change name of view column »).
CREATE OR REPLACE VIEW v_stock_status AS
SELECT
  -- — ordre historique 0010, à ne pas déplacer —
  s.id, s.name, s.unit, s.quantity, s.alert_threshold, s.depot_code,
  COALESCE(r.reserved, 0) AS reserved,
  s.quantity - COALESCE(r.reserved, 0) AS available,
  CASE
    WHEN s.alert_threshold > 0 AND s.quantity <= s.alert_threshold THEN true
    ELSE false
  END AS low_stock,
  -- — colonnes ajoutées par 0015 —
  s.usine_code, s.code, s.article_id, s.prix_unitaire,
  COALESCE(s.famille_nom, f.nom) AS famille,
  s.is_demo, a.est_mp, a.est_fabrique,
  (s.quantity * COALESCE(s.prix_unitaire, a.prix_achat, 0)) AS valeur
FROM stock_items s
LEFT JOIN erp_articles a ON a.id = s.article_id
LEFT JOIN erp_familles f ON f.id = a.famille_id
LEFT JOIN (
  SELECT oir.stock_item_id, SUM(oir.estimated_qty - oir.consumed_qty) AS reserved
  FROM order_item_reservations oir
  JOIN work_order_items woi ON woi.id = oir.order_item_id
  WHERE woi.status NOT IN ('RELEASED','CANCELLED')
  GROUP BY oir.stock_item_id
) r ON r.stock_item_id = s.id;

-- ── 7. VUE : valorisation du stock (pour le tableau de bord financier) ──
CREATE OR REPLACE VIEW v_stock_valorisation AS
SELECT
  depot_code,
  usine_code,
  COUNT(*)                                        AS nb_articles,
  SUM(quantity)                                   AS quantite_totale,
  SUM(quantity * COALESCE(prix_unitaire, 0))      AS valeur_totale,
  COUNT(*) FILTER (WHERE quantity <= alert_threshold) AS nb_sous_seuil
FROM stock_items
WHERE is_demo = false
GROUP BY depot_code, usine_code;

-- ── 8. DROITS (même règle que 0012) ──
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
