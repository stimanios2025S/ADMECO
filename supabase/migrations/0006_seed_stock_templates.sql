-- ═══════════════════════════════════════════
-- SEED: Stock items for ADEMCO
-- ═══════════════════════════════════════════
INSERT INTO stock_items(name, unit, quantity, alert_threshold) VALUES
('Bois de planche', 'm²', 500, 50),
('Tôle acier', 'm', 300, 30),
('Profilé acier', 'm', 200, 20),
('Tube acier carré', 'm', 150, 15),
('Fil à souder', 'kg', 80, 10),
('Boulons & écrous', 'pcs', 5000, 500),
('Vis inox', 'pcs', 10000, 1000),
('Rivets', 'pcs', 3000, 300),
('Colle bois', 'L', 40, 5),
('Peinture poudre polyester', 'kg', 100, 10),
('Grain papier abrasif', 'pcs', 200, 20),
('Disque meulage', 'pcs', 50, 5),
('Feuille aluminium', 'm²', 80, 10)
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════
-- SEED: Process templates with branching
-- ═══════════════════════════════════════════
-- Atelier 1: Chaises (IDs 1–10)
-- Atelier 2: Chaises (IDs 11–18)

-- First clear existing templates for clean reseed
DELETE FROM process_templates;

-- CHAIRS - ATELIER 1
INSERT INTO process_templates(category_id, step_order, atelier_id, step_name, estimated_minutes, standard_materials, has_branch, branch_insert_name, branch_insert_materials, branch_insert_minutes)
SELECT c.id, 1, 1, 'Arrivée matière première', 15,
  '[{"material":"Bois de planche","qty":2.5,"unit":"m²"}]'::jsonb,
  false, null, '[]'::jsonb, 0
FROM product_categories c WHERE c.name = 'Chairs';

INSERT INTO process_templates(category_id, step_order, atelier_id, step_name, estimated_minutes, standard_materials, has_branch, branch_insert_name, branch_insert_materials, branch_insert_minutes)
SELECT c.id, 2, 1, 'La coupe', 40,
  '[{"material":"Bois de planche","qty":2.3,"unit":"m²"}]'::jsonb,
  false, null, '[]'::jsonb, 0
FROM product_categories c WHERE c.name = 'Chairs';

INSERT INTO process_templates(category_id, step_order, atelier_id, step_name, estimated_minutes, standard_materials, has_branch, branch_insert_name, branch_insert_materials, branch_insert_minutes)
SELECT c.id, 3, 1, 'Ponçage', 30,
  '[{"material":"Grain papier abrasif","qty":4,"unit":"pcs"}]'::jsonb,
  true, 'Perçage',
  '[{"material":"Bois de planche","qty":0.1,"unit":"m²"}]'::jsonb, 20
FROM product_categories c WHERE c.name = 'Chairs';

INSERT INTO process_templates(category_id, step_order, atelier_id, step_name, estimated_minutes, standard_materials, has_branch, branch_insert_name, branch_insert_materials, branch_insert_minutes)
SELECT c.id, 4, 1, 'Soudage', 35,
  '[{"material":"Fil à souder","qty":0.5,"unit":"kg"},{"material":"Tube acier carré","qty":2,"unit":"m"}]'::jsonb,
  false, null, '[]'::jsonb, 0
FROM product_categories c WHERE c.name = 'Chairs';

INSERT INTO process_templates(category_id, step_order, atelier_id, step_name, estimated_minutes, standard_materials, has_branch, branch_insert_name, branch_insert_materials, branch_insert_minutes)
SELECT c.id, 5, 1, 'Vissage', 25,
  '[{"material":"Vis inox","qty":24,"unit":"pcs"}]'::jsonb,
  true, 'Moullage',
  '[{"material":"Tube acier carré","qty":1,"unit":"m"},{"material":"Disque meulage","qty":1,"unit":"pcs"}]'::jsonb, 15
FROM product_categories c WHERE c.name = 'Chairs';

INSERT INTO process_templates(category_id, step_order, atelier_id, step_name, estimated_minutes, standard_materials, has_branch, branch_insert_name, branch_insert_materials, branch_insert_minutes)
SELECT c.id, 6, 1, 'Poudrage', 30,
  '[{"material":"Peinture poudre polyester","qty":1.2,"unit":"kg"}]'::jsonb,
  false, null, '[]'::jsonb, 0
FROM product_categories c WHERE c.name = 'Chairs';

INSERT INTO process_templates(category_id, step_order, atelier_id, step_name, estimated_minutes, standard_materials, has_branch, branch_insert_name, branch_insert_materials, branch_insert_minutes)
SELECT c.id, 7, 1, 'Vissage + Montage/Assemblage', 40,
  '[{"material":"Vis inox","qty":16,"unit":"pcs"},{"material":"Boulons & écrous","qty":8,"unit":"pcs"}]'::jsonb,
  false, null, '[]'::jsonb, 0
FROM product_categories c WHERE c.name = 'Chairs';

INSERT INTO process_templates(category_id, step_order, atelier_id, step_name, estimated_minutes, standard_materials, has_branch, branch_insert_name, branch_insert_materials, branch_insert_minutes)
SELECT c.id, 8, 1, 'Emballage', 15,
  '[]'::jsonb,
  false, null, '[]'::jsonb, 0
FROM product_categories c WHERE c.name = 'Chairs';

-- CHAIRS - ATELIER 2
INSERT INTO process_templates(category_id, step_order, atelier_id, step_name, estimated_minutes, standard_materials, has_branch, branch_insert_name, branch_insert_materials, branch_insert_minutes)
SELECT c.id, 9, 2, 'Arrivée Atelier 2', 10,
  '[{"material":"Tube acier carré","qty":3,"unit":"m"}]'::jsonb,
  false, null, '[]'::jsonb, 0
FROM product_categories c WHERE c.name = 'Chairs';

INSERT INTO process_templates(category_id, step_order, atelier_id, step_name, estimated_minutes, standard_materials, has_branch, branch_insert_name, branch_insert_materials, branch_insert_minutes)
SELECT c.id, 10, 2, 'Coupe métal', 30,
  '[{"material":"Tube acier carré","qty":2.8,"unit":"m"},{"material":"Tôle acier","qty":0.5,"unit":"m"}]'::jsonb,
  false, null, '[]'::jsonb, 0
FROM product_categories c WHERE c.name = 'Chairs';

INSERT INTO process_templates(category_id, step_order, atelier_id, step_name, estimated_minutes, standard_materials, has_branch, branch_insert_name, branch_insert_materials, branch_insert_minutes)
SELECT c.id, 11, 2, 'Ponçage métal', 20,
  '[{"material":"Disque meulage","qty":2,"unit":"pcs"},{"material":"Grain papier abrasif","qty":2,"unit":"pcs"}]'::jsonb,
  false, null, '[]'::jsonb, 0
FROM product_categories c WHERE c.name = 'Chairs';

INSERT INTO process_templates(category_id, step_order, atelier_id, step_name, estimated_minutes, standard_materials, has_branch, branch_insert_name, branch_insert_materials, branch_insert_minutes)
SELECT c.id, 12, 2, 'Grçage', 25,
  '[{"material":"Disque meulage","qty":1,"unit":"pcs"}]'::jsonb,
  false, null, '[]'::jsonb, 0
FROM product_categories c WHERE c.name = 'Chairs';

INSERT INTO process_templates(category_id, step_order, atelier_id, step_name, estimated_minutes, standard_materials, has_branch, branch_insert_name, branch_insert_materials, branch_insert_minutes)
SELECT c.id, 13, 2, 'Pliage', 30,
  '[]'::jsonb,
  false, null, '[]'::jsonb, 0
FROM product_categories c WHERE c.name = 'Chairs';

INSERT INTO process_templates(category_id, step_order, atelier_id, step_name, estimated_minutes, standard_materials, has_branch, branch_insert_name, branch_insert_materials, branch_insert_minutes)
SELECT c.id, 14, 2, 'Poudrage métal', 25,
  '[{"material":"Peinture poudre polyester","qty":0.8,"unit":"kg"}]'::jsonb,
  false, null, '[]'::jsonb, 0
FROM product_categories c WHERE c.name = 'Chairs';

INSERT INTO process_templates(category_id, step_order, atelier_id, step_name, estimated_minutes, standard_materials, has_branch, branch_insert_name, branch_insert_materials, branch_insert_minutes)
SELECT c.id, 15, 2, 'Emballage Atelier 2', 10,
  '[]'::jsonb,
  false, null, '[]'::jsonb, 0
FROM product_categories c WHERE c.name = 'Chairs';

-- ═══════════════════════════════════════════
-- DUPLICATE TEMPLATES FOR OTHER CATEGORIES (clone from Chairs)
-- ═══════════════════════════════════════════
INSERT INTO process_templates(category_id, step_order, atelier_id, step_name, estimated_minutes, standard_materials, has_branch, branch_insert_name, branch_insert_materials, branch_insert_minutes)
SELECT pc.id, t.step_order, t.atelier_id, t.step_name, t.estimated_minutes, t.standard_materials, t.has_branch, t.branch_insert_name, t.branch_insert_materials, t.branch_insert_minutes
FROM process_templates t
CROSS JOIN product_categories pc
WHERE pc.name IN ('Dining Tables','Cabinets','Armchairs')
  AND t.category_id = (SELECT id FROM product_categories WHERE name = 'Chairs')
ON CONFLICT (category_id, step_order) DO NOTHING;
