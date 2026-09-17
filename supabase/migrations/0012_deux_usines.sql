-- ═══════════════════════════════════════════
-- MIGRATION 0012 : DEUX USINES — ADMEDCO + MOBILIX
-- Usines : ADMEDCO (A1 Bois & Découpe, A2 Assemblage & Finition)
--          MOBILIX (M1 Réception & Finition)
-- Chaque usine a son stock MP centrale séparé + ses stocks ateliers.
-- Destinations (décision Admin ADMEDCO) : MOBILIX | CLIENT_DIRECT
-- À exécuter APRÈS 0011 dans Supabase SQL Editor
-- Ré-exécutable, idempotent (IF NOT EXISTS + ON CONFLICT + DROP POLICY IF EXISTS)
-- ═══════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── 1. USINES (code PK : 'ADMEDCO' | 'MOBILIX') ──
CREATE TABLE IF NOT EXISTS usines (
  code TEXT PRIMARY KEY,
  nom TEXT NOT NULL
);

-- ── 2. FOURNISSEURS (scopés par usine) ──
CREATE TABLE IF NOT EXISTS fournisseurs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usine_code TEXT NOT NULL DEFAULT 'ADMEDCO',
  nom TEXT NOT NULL,
  telephone TEXT DEFAULT '',
  nif TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── 3. RÉCEPTIONS MP (proposées par le magasinier, confirmées par l'admin) ──
CREATE TABLE IF NOT EXISTS receptions_mp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usine_code TEXT NOT NULL DEFAULT 'ADMEDCO',
  fournisseur_id UUID REFERENCES fournisseurs(id),
  numero_facture TEXT DEFAULT '',
  lignes JSONB DEFAULT '[]'::jsonb,
  statut TEXT DEFAULT 'PROPOSEE' CHECK (statut IN ('PROPOSEE','CONFIRMEE')),
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── 4. ÉVÉNEMENTS DE RÉSERVATION (réserve / consommation / emprunt / alerte) ──
CREATE TABLE IF NOT EXISTS reservation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID,
  stock_item_id UUID,
  type TEXT NOT NULL CHECK (type IN ('RESERVE','CONSUME','BORROW','ALERT')),
  qty NUMERIC DEFAULT 0,
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── 5. ALERTES (scopées par usine) ──
CREATE TABLE IF NOT EXISTS alertes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usine_code TEXT NOT NULL DEFAULT 'ADMEDCO',
  type TEXT NOT NULL DEFAULT 'INFO',
  message TEXT NOT NULL,
  lu BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── 6. DESTINATIONS (décision Admin ADMEDCO : vers MOBILIX ou client direct) ──
CREATE TABLE IF NOT EXISTS destinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  semi_stock_id UUID,
  order_item_id UUID,
  destination TEXT NOT NULL CHECK (destination IN ('MOBILIX','CLIENT_DIRECT')),
  bordereau TEXT DEFAULT '',
  statut TEXT DEFAULT 'DECIDE' CHECK (statut IN ('DECIDE','EXPEDIE','LIVRE')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── 7. COLONNES MULTI-USINES ──
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS usine_code TEXT DEFAULT 'ADMEDCO';
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS usine_code TEXT DEFAULT 'ADMEDCO';
ALTER TABLE site_transfers ADD COLUMN IF NOT EXISTS destination TEXT DEFAULT 'MOBILIX';
ALTER TABLE site_transfers ADD COLUMN IF NOT EXISTS usine_code TEXT DEFAULT 'ADMEDCO';
ALTER TABLE material_logs ADD COLUMN IF NOT EXISTS quantity_ok NUMERIC DEFAULT 0;
ALTER TABLE work_order_steps ADD COLUMN IF NOT EXISTS quantity_ok NUMERIC DEFAULT 0;
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS usine_code TEXT DEFAULT 'ADMEDCO';

-- ── 8. RÔLES : ADMIN | WORKER | MAGASINIER (scopé par profiles.usine_code) ──
-- Supprime l'ancien CHECK sur profiles.role (nom auto Postgres : profiles_role_check)
-- puis recrée avec MAGASINIER — idempotent via test pg_constraint
UPDATE profiles SET role = 'WORKER' WHERE role NOT IN ('ADMIN','WORKER','MAGASINIER');
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'profiles'::regclass
      AND conname = 'profiles_role_check'
  ) THEN
    ALTER TABLE profiles DROP CONSTRAINT profiles_role_check;
  END IF;
  ALTER TABLE profiles
    ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('ADMIN','WORKER','MAGASINIER'));
END $$;

-- ── 9. SEEDS ──
-- 9a. Usines
INSERT INTO usines(code, nom) VALUES
('ADMEDCO', 'Usine ADMEDCO — Production'),
('MOBILIX', 'Usine MOBILIX — Réception & Finition')
ON CONFLICT DO NOTHING;

-- 9b. Atelier M1 (usine MOBILIX)
INSERT INTO ateliers(id, code, name, site) VALUES
(3, 'M1', 'Atelier MOBILIX — Réception & Finition', 'MOBILIX')
ON CONFLICT (id) DO UPDATE SET code = EXCLUDED.code, name = EXCLUDED.name, site = EXCLUDED.site;

-- 9c. Dépôts MOBILIX : centrale MP (commune, atelier NULL) + stock atelier M1
INSERT INTO erp_depots(code, nom, atelier_id) VALUES
('DEP-MP-MBX', 'Stock Matière Première — Centrale MOBILIX', NULL),
('DEP-M1', 'Stock Atelier MOBILIX — Réception & Finition', 3)
ON CONFLICT (code) DO NOTHING;

-- 9d. Tout le stock existant appartient à l'usine ADMEDCO
UPDATE stock_items SET usine_code = 'ADMEDCO' WHERE usine_code IS NULL OR usine_code = '';

-- 9e. Catégories MOBILIX (work_order_items.category_id est NOT NULL)
INSERT INTO product_categories(name, description) VALUES
('Chaise G21', 'Chaise G21 MOBILIX — 8 inserts, piètement G21 (suivi 19 QR)'),
('Chaise CANADA', 'Chaise Canada MOBILIX — 12 inserts, accoudoirs (suivi 19 QR)')
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════
-- RLS : lecture authentifiée, écriture admin (même règle que 0009)
-- ═══════════════════════════════════════════
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['usines','fournisseurs','receptions_mp','reservation_events','alertes','destinations']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "auth read all" ON %I', t);
    EXECUTE format('CREATE POLICY "auth read all" ON %I FOR SELECT TO authenticated USING (true)', t);
    EXECUTE format('DROP POLICY IF EXISTS "admin write all" ON %I', t);
    EXECUTE format('CREATE POLICY "admin write all" ON %I FOR ALL TO authenticated USING (exists(select 1 from profiles p where p.id = auth.uid() and p.role = %L)) WITH CHECK (exists(select 1 from profiles p where p.id = auth.uid() and p.role = %L))', t, 'ADMIN', 'ADMIN');
  END LOOP;
END $$;

-- ═══════════════════════════════════════════
-- DROITS : comme le script grants déjà utilisé
-- ═══════════════════════════════════════════
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
