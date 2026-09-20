-- ═══════════════════════════════════════════════════════════
-- MIGRATION 0018 : LES COLONNES QUE L'IMPORT SILWANE EXIGE
--
-- ── Pourquoi cette migration existe ──
-- `scripts/import-silwane.mjs` envoie `sil_oid` dans chaque ligne
-- qu'il écrit dans `erp_familles`. Or AUCUNE migration ne crée cette
-- colonne : 0009 définit erp_familles avec (id, code, nom, created_at)
-- et rien d'autre. 0011 renomme des colonnes d'erp_articles, elle ne
-- touche pas aux familles.
--
-- Relevé sur le serveur le 2026-09-20 :
--
--     Error: erp_familles [lignes 1-17] :
--     Could not find the 'sil_oid' column of 'erp_familles'
--     in the schema cache
--
-- L'import s'arrête donc à sa PREMIÈRE étape et la base reste vide
-- (erp_articles = 0, erp_nomenclatures = 0) alors que le --dry, lui,
-- annonce 706 articles et 2139 lignes de nomenclature : le mode --dry
-- ne parle qu'aux CSV, jamais à la base, il ne pouvait pas voir le trou.
--
-- ── Ce qu'elle fait ──
-- 1. Ajoute la colonne manquante, et l'index unique qui va avec.
-- 2. Ré-affirme, de façon idempotente, TOUTES les colonnes qu'écrit
--    l'import sur erp_articles (celles de 0011 et 0015). Sans effet si
--    ces deux migrations sont passées — répare si elles ne le sont pas.
-- 3. Retire les 7 familles de remplissage de 0009, devenues du bruit
--    dans le filtre « famille » une fois le vrai catalogue importé.
-- 4. Demande à PostgREST de relire le schéma.
--
-- ⚠️ Le point 4 n'est pas décoratif : PostgREST garde le schéma en
-- cache et répondrait « Could not find the 'sil_oid' column … in the
-- schema cache » ALORS QUE la colonne existe. Sans le NOTIFY, on croit
-- la migration inutile et on cherche la panne ailleurs.
--
-- Ré-exécutable. À exécuter AVANT `node scripts/import-silwane.mjs`.
-- ═══════════════════════════════════════════════════════════

-- ── 1. erp_familles : la colonne qui manquait ──
ALTER TABLE erp_familles ADD COLUMN IF NOT EXISTS sil_oid TEXT;

-- Index partiel : plusieurs familles peuvent n'avoir aucun sil_oid
-- (celles créées à la main dans l'application), une seule non.
CREATE UNIQUE INDEX IF NOT EXISTS uq_erp_familles_sil_oid
  ON erp_familles(sil_oid) WHERE sil_oid IS NOT NULL;

-- ── 2. erp_articles : le contrat complet de l'import ──
-- (0009 fournit id, sil_oid, code, designation, famille_id, unite,
--  prix_achat, prix_vente, stock_logique, stock_reserve, stock_min,
--  stock_max, perissable, bloque, code_barres — le reste vient d'ici.)
ALTER TABLE erp_articles ADD COLUMN IF NOT EXISTS est_fabrique  BOOLEAN DEFAULT false; -- IsBOM
ALTER TABLE erp_articles ADD COLUMN IF NOT EXISTS est_mp        BOOLEAN DEFAULT false; -- IsRawMaterial
ALTER TABLE erp_articles ADD COLUMN IF NOT EXISTS est_semi_fini BOOLEAN DEFAULT false; -- IsSemiFinished
ALTER TABLE erp_articles ADD COLUMN IF NOT EXISTS sil_type      TEXT    DEFAULT '';
ALTER TABLE erp_articles ADD COLUMN IF NOT EXISTS tva           TEXT    DEFAULT '';
ALTER TABLE erp_articles ADD COLUMN IF NOT EXISTS stock_physique NUMERIC DEFAULT 0;     -- PhysicalQuantity
ALTER TABLE erp_articles ADD COLUMN IF NOT EXISTS reference     TEXT    DEFAULT '';
ALTER TABLE erp_articles ADD COLUMN IF NOT EXISTS emplacement   TEXT    DEFAULT '';

-- ── 3. Les 7 familles de remplissage de 0009 s'en vont ──
-- Elles n'existaient que pour permettre à 0009 de semer ses articles
-- de démo. Le catalogue réel arrive avec ses 17 vraies familles : les
-- garder ne ferait que polluer le filtre « famille » de /admin/articles.
-- On ne supprime QUE celles qu'aucun article ne référence — si une est
-- utilisée, elle reste, et rien n'est cassé en silence.
DELETE FROM erp_familles f
WHERE f.code IN ('FAM-CHA','FAM-TAB','FAM-ARM','FAM-FAU','FAM-PME','FAM-MP','FAM-QCA')
  AND NOT EXISTS (SELECT 1 FROM erp_articles a WHERE a.famille_id = f.id);

-- ── 4. PostgREST doit voir le nouveau schéma ──
NOTIFY pgrst, 'reload schema';
