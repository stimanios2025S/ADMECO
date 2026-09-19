-- ═══════════════════════════════════════════════════════════
-- MIGRATION 0016 : ATELIER 3 — POUDRAGE & EMBALLAGE
--
-- MODÈLE D'USINE (donné par le client) :
--   Atelier 1 (ADMEDCO) — le LOURD / la TÔLE : coupe, perçage, soudage
--   Atelier 2 (ADMEDCO) — le BUREAU
--   Atelier 3 (ADMEDCO) — POUDRAGE + EMBALLAGE, pour les DEUX
--
--   ORDRE RETENU PAR L'EXPLOITANT : ON POUDRE AVANT DE MONTER.
--   La pièce passe donc DEUX FOIS à l'Atelier 3, et l'Atelier 2 n'assemble
--   que des pièces déjà peintes.
--
--       A1 (tôle) ─┐
--                  ├─→ A3 phase 1 (poudrage) → A2 (montage) → A3 phase 2 (emballage) → Stock PF
--       A2 (métal) ┘
--
--   Les deux ateliers de fabrication ne se rejoignent pas : ils livrent
--   tous les deux au même atelier de finition. A3 est donc le point de
--   convergence, pas une troisième ligne de production parallèle.
--
--   Justification du choix : 151 produits de la nomenclature Silwane portent
--   à la fois du montage (MD004) et du garnissage mousse/skaï — on ne fait
--   pas passer de la mousse au four. Le coût est un aller-retour A3 → A2 → A3.
--
--   ⚠️ La gamme (7 étapes A3, 6 étapes A2, 7 étapes A1) vit dans le code :
--      src/lib/etapes.ts et src/lib/process-admedco-a1.ts. Elle n'est pas
--      dupliquée ici. Le champ `phase` (« Poudrage (phase 1) » /
--      « Emballage (phase 2) ») y porte les deux passes.
--
-- ⚠️ ID = 4, PAS 3. L'id 3 est déjà pris par MOBILIX (M1) depuis 0012.
--    Le réattribuer réécrirait `atelier_id` sur tout l'historique de
--    production MOBILIX (work_order_steps, process_templates,
--    semi_finished_stock, profiles) — 0008 a déjà fait ce genre de
--    réaffectation, on ne le refait pas. Le numéro AFFICHÉ reste
--    « Atelier 3 » : c'est `id` qui est la clé technique.
--
-- À exécuter APRÈS 0015. Ré-exécutable, idempotent.
-- ═══════════════════════════════════════════════════════════

-- ── 1. LE NOUVEL ATELIER ──
-- Inséré AVANT tout dépôt : erp_depots.atelier_id référence ateliers(id).
INSERT INTO ateliers(id, code, name, site) VALUES
(4, 'A3', 'Atelier 3 — Poudrage & Emballage', 'ADMEDCO')
ON CONFLICT (id) DO UPDATE SET code = EXCLUDED.code, name = EXCLUDED.name, site = EXCLUDED.site;

-- ── 2. RÉ-ÉTIQUETER A1 ET A2 SELON LEUR VRAIE FONCTION ──
-- « Bois & Découpe » / « Assemblage & Finition » ne décrivent plus le
-- travail réel. Le nom est ce que lit l'ouvrier sur son portail.
UPDATE ateliers SET name = 'Atelier 1 — Tôle & Gros œuvre'
  WHERE id = 1 AND code = 'A1';
UPDATE ateliers SET name = 'Atelier 2 — Bureau'
  WHERE id = 2 AND code = 'A2';

-- ── 3. LE DÉPÔT DE L'ATELIER 3 ──
-- Ce que A1 et A2 ont produit, en attente de poudrage puis d'emballage.
INSERT INTO erp_depots(code, nom, atelier_id) VALUES
('DEP-A3', 'Dépôt Atelier 3 — Poudrage & Emballage', 4)
ON CONFLICT (code) DO NOTHING;

-- Aligner les libellés des dépôts existants sur les nouveaux noms d'atelier
UPDATE erp_depots SET nom = 'Dépôt Atelier 1 — Tôle & Gros œuvre' WHERE code = 'DEP-A1';
UPDATE erp_depots SET nom = 'Dépôt Atelier 2 — Bureau'            WHERE code = 'DEP-A2';

-- ── 4. AUCUN ORPHELIN À RÉAFFECTER ──
-- Contrairement à 0008, cet atelier est NEUF : rien en base ne peut déjà
-- pointer vers lui. On ne touche donc à aucune ligne de production
-- existante. Vérité de contrôle après migration :
--   SELECT atelier_id, COUNT(*) FROM work_order_steps GROUP BY atelier_id;
--   → seules les valeurs 1, 2 et 3 doivent apparaître (4 = encore vide).

-- ── 5. DROITS (même règle que 0012 / 0015) ──
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
