-- ═══════════════════════════════════════════
-- MIGRATION 0008 : ADMEDCO — 2 ateliers, 100 % français
-- À exécuter APRÈS 0007 dans Supabase SQL Editor
-- ═══════════════════════════════════════════

-- 1. Ateliers : exactement 2 (supprime l'ancien Atelier 3)
DELETE FROM ateliers WHERE id = 3;
INSERT INTO ateliers(id, code, name, site) VALUES
(1, 'A1', 'Atelier 1 — Bois & Découpe', 'ADMEDCO'),
(2, 'A2', 'Atelier 2 — Assemblage & Finition', 'ADMEDCO')
ON CONFLICT (id) DO UPDATE SET code = EXCLUDED.code, name = EXCLUDED.name, site = EXCLUDED.site;

-- 2. Étapes orphelines pointant vers l'ancien atelier 3 → atelier 2
UPDATE process_templates SET atelier_id = 2 WHERE atelier_id = 3;
UPDATE work_order_steps SET atelier_id = 2 WHERE atelier_id = 3;
UPDATE semi_finished_stock SET atelier_id = 2 WHERE atelier_id = 3;
UPDATE profiles SET atelier_id = 2 WHERE atelier_id = 3;
UPDATE profiles SET atelier_id = NULL WHERE atelier_id NOT IN (1, 2);

-- 3. Ré-étiqueter les catégories produits en français
UPDATE product_categories SET name = 'Chaises' WHERE name IN ('Chairs');
UPDATE product_categories SET name = 'Tables à manger' WHERE name IN ('Dining Tables');
UPDATE product_categories SET name = 'Armoires' WHERE name IN ('Cabinets');
UPDATE product_categories SET name = 'Fauteuils' WHERE name IN ('Armchairs');
UPDATE product_categories SET name = 'Pieds Métal' WHERE name IN ('Metal Legs', 'Metal Feet');

-- 4. Restaurer la contrainte profiles.atelier_id si elle existe encore
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_atelier_id_fkey'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_atelier_id_fkey
      FOREIGN KEY (atelier_id) REFERENCES ateliers(id);
  END IF;
END $$;
