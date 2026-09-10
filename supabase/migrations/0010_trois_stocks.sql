-- ═══════════════════════════════════════════
-- MIGRATION 0010 : 3 STOCKS ADMEDCO
-- 1) DEP-MP centrale = matière première, alimente A1 + A2 au début
-- 2) Stock Atelier 1 = ce que A1 a produit (semi_finished_stock atelier 1)
-- 3) Stock Atelier 2 = ce que A2 a produit (semi_finished_stock atelier 2)
-- À exécuter APRÈS 0009 dans Supabase SQL Editor
-- ═══════════════════════════════════════════

-- 1. Dépôt central matière première (atelier_id NULL = commun aux 2 ateliers)
INSERT INTO erp_depots(code, nom, atelier_id) VALUES
('DEP-MP', 'Stock Matière Première — Centrale (alimente A1 + A2)', NULL)
ON CONFLICT (code) DO NOTHING;

-- 2. Marquer chaque article de stock_items avec son dépôt
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS depot_code TEXT NOT NULL DEFAULT 'DEP-MP';
UPDATE stock_items SET depot_code = 'DEP-MP' WHERE depot_code IS NULL OR depot_code = '';
CREATE INDEX IF NOT EXISTS idx_stock_depot ON stock_items(depot_code);

-- Toutes les matières existantes appartiennent à la centrale MP
UPDATE stock_items SET depot_code = 'DEP-MP';

-- 3. Tracer le dépôt dans les mouvements (audit : depuis quel stock on consomme)
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS depot_code TEXT NOT NULL DEFAULT 'DEP-MP';

-- 4. Vue stock : expose le dépôt pour filtrer MP / A1 / A2 côté portail
CREATE OR REPLACE VIEW v_stock_status AS
SELECT
  s.id, s.name, s.unit, s.quantity, s.alert_threshold, s.depot_code,
  COALESCE(r.reserved, 0) AS reserved,
  s.quantity - COALESCE(r.reserved, 0) AS available,
  CASE WHEN s.quantity <= s.alert_threshold THEN true ELSE false END AS low_stock
FROM stock_items s
LEFT JOIN (
  SELECT oir.stock_item_id, SUM(oir.estimated_qty - oir.consumed_qty) AS reserved
  FROM order_item_reservations oir
  JOIN work_order_items woi ON woi.id = oir.order_item_id
  WHERE woi.status NOT IN ('RELEASED','CANCELLED')
  GROUP BY oir.stock_item_id
) r ON r.stock_item_id = s.id;

-- 5. Vue atelier : Stock A1 = produit par A1, Stock A2 = produit par A2
CREATE OR REPLACE VIEW v_stock_ateliers AS
SELECT atelier_id, status, COUNT(*) AS lignes, COALESCE(SUM(quantity),0) AS quantite
FROM semi_finished_stock
GROUP BY atelier_id, status;
