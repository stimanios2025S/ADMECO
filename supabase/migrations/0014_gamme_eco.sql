-- 0014 — Gamme ECO Atelier 01 : objectif par étape, priorité commandes, stock produit fini
-- - work_order_steps.target_qty : objectif du matin fixé par l'admin (combien produire)
-- - work_orders.priority : priorité admin (1 = urgent … 5 = basse), défaut 3
-- - work_orders.product_line : famille produit (ex. ECO), défaut ECO
-- Idempotent : ADD COLUMN IF NOT EXISTS.

ALTER TABLE work_order_steps
  ADD COLUMN IF NOT EXISTS target_qty numeric NOT NULL DEFAULT 0;

ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS priority int NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS product_line text NOT NULL DEFAULT 'ECO';

-- Stock produit fini ADMEDCO (alimenté par l'étape 7 ECO-STOCK)
INSERT INTO erp_depots (code, nom)
  VALUES ('DEP-PF', 'Stock Produit Fini — ADMEDCO')
  ON CONFLICT (code) DO NOTHING;

-- Temps réel sur les commandes (priorités visibles en direct sur le portail)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'work_orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE work_orders;
  END IF;
END $$;
