-- ═══════════════════════════════════════════
-- MIGRATION 0007: Pied Métal Eco Renforcer
-- BOM from ERP screenshot + production template
-- ═══════════════════════════════════════════

-- 1. NEW STOCK ITEMS (missing from 0006 seed)
INSERT INTO stock_items(name, unit, quantity, alert_threshold) VALUES
('Equairres 90° plastique noir', 'pcs', 500, 50),
('Insert M8', 'pcs', 2000, 200),
('Insert M6', 'pcs', 2000, 200),
('Pied réglables M8 37', 'pcs', 500, 50),
('Tube 60x30x10', 'pcs', 200, 20),
('Vis RLF M6x12', 'pcs', 5000, 500)
ON CONFLICT DO NOTHING;

-- 2. NEW PRODUCT CATEGORY
INSERT INTO product_categories(name) VALUES ('Pieds Métal') ON CONFLICT DO NOTHING;

-- 3. PRODUCTION TEMPLATE (8 steps, branching at step 1)
--    Materials allocated per BOM quantities

-- STEP 1: Arrivée matière première
INSERT INTO process_templates(category_id, step_order, atelier_id, step_name, estimated_minutes, standard_materials, has_branch, branch_insert_name, branch_insert_materials, branch_insert_minutes)
SELECT c.id, 1, 1, 'Arrivée matière première', 15,
  '[
    {"material":"Tube 60x30x10","qty":1,"unit":"pcs"},
    {"material":"Insert M8","qty":4,"unit":"pcs"},
    {"material":"Insert M6","qty":8,"unit":"pcs"}
  ]'::jsonb,
  true, 'Ponçage préparatoire',
  '[{"material":"Grain papier abrasif","qty":4,"unit":"pcs"},{"material":"Disque meulage","qty":2,"unit":"pcs"}]'::jsonb, 20
FROM product_categories c WHERE c.name = 'Pieds Métal'
ON CONFLICT (category_id, step_order) DO NOTHING;

-- STEP 2: Préparation & perçage
INSERT INTO process_templates(category_id, step_order, atelier_id, step_name, estimated_minutes, standard_materials, has_branch, branch_insert_name, branch_insert_materials, branch_insert_minutes)
SELECT c.id, 2, 1, 'Préparation & perçage', 90,
  '[
    {"material":"Pied réglables M8 37","qty":4,"unit":"pcs"},
    {"material":"Equairres 90° plastique noir","qty":8,"unit":"pcs"},
    {"material":"Boulons & écrous","qty":12,"unit":"pcs"}
  ]'::jsonb,
  false, null, '[]'::jsonb, 0
FROM product_categories c WHERE c.name = 'Pieds Métal'
ON CONFLICT (category_id, step_order) DO NOTHING;

-- STEP 3: Soudage
INSERT INTO process_templates(category_id, step_order, atelier_id, step_name, estimated_minutes, standard_materials, has_branch, branch_insert_name, branch_insert_materials, branch_insert_minutes)
SELECT c.id, 3, 1, 'Soudage', 30,
  '[
    {"material":"Fil à souder","qty":0.5,"unit":"kg"},
    {"material":"Vis RLF M6x12","qty":8,"unit":"pcs"},
    {"material":"Rivets","qty":8,"unit":"pcs"}
  ]'::jsonb,
  false, null, '[]'::jsonb, 0
FROM product_categories c WHERE c.name = 'Pieds Métal'
ON CONFLICT (category_id, step_order) DO NOTHING;

-- STEP 4: Poudrage
INSERT INTO process_templates(category_id, step_order, atelier_id, step_name, estimated_minutes, standard_materials, has_branch, branch_insert_name, branch_insert_materials, branch_insert_minutes)
SELECT c.id, 4, 1, 'Poudrage époxy gris', 25,
  '[
    {"material":"Peinture poudre polyester","qty":0.15,"unit":"kg"},
    {"material":"Disque meulage","qty":1,"unit":"pcs"}
  ]'::jsonb,
  false, null, '[]'::jsonb, 0
FROM product_categories c WHERE c.name = 'Pieds Métal'
ON CONFLICT (category_id, step_order) DO NOTHING;

-- STEP 5: Contrôle qualité
INSERT INTO process_templates(category_id, step_order, atelier_id, step_name, estimated_minutes, standard_materials, has_branch, branch_insert_name, branch_insert_materials, branch_insert_minutes)
SELECT c.id, 5, 2, 'Contrôle qualité', 20,
  '[]'::jsonb,
  false, null, '[]'::jsonb, 0
FROM product_categories c WHERE c.name = 'Pieds Métal'
ON CONFLICT (category_id, step_order) DO NOTHING;

-- STEP 6: Assemblage final
INSERT INTO process_templates(category_id, step_order, atelier_id, step_name, estimated_minutes, standard_materials, has_branch, branch_insert_name, branch_insert_materials, branch_insert_minutes)
SELECT c.id, 6, 2, 'Assemblage final', 30,
  '[
    {"material":"Equairres 90° plastique noir","qty":8,"unit":"pcs"},
    {"material":"Pied réglables M8 37","qty":4,"unit":"pcs"},
    {"material":"Vis inox","qty":16,"unit":"pcs"}
  ]'::jsonb,
  false, null, '[]'::jsonb, 0
FROM product_categories c WHERE c.name = 'Pieds Métal'
ON CONFLICT (category_id, step_order) DO NOTHING;

-- STEP 7: Emballage
INSERT INTO process_templates(category_id, step_order, atelier_id, step_name, estimated_minutes, standard_materials, has_branch, branch_insert_name, branch_insert_materials, branch_insert_minutes)
SELECT c.id, 7, 2, 'Emballage', 30,
  '[
    {"material":"Feuille aluminium","qty":0.5,"unit":"m²"}
  ]'::jsonb,
  false, null, '[]'::jsonb, 0
FROM product_categories c WHERE c.name = 'Pieds Métal'
ON CONFLICT (category_id, step_order) DO NOTHING;

-- STEP 8: Expédition
INSERT INTO process_templates(category_id, step_order, atelier_id, step_name, estimated_minutes, standard_materials, has_branch, branch_insert_name, branch_insert_materials, branch_insert_minutes)
SELECT c.id, 8, 2, 'Expédition', 10,
  '[]'::jsonb,
  false, null, '[]'::jsonb, 0
FROM product_categories c WHERE c.name = 'Pieds Métal'
ON CONFLICT (category_id, step_order) DO NOTHING;
