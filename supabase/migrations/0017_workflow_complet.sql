-- ═══════════════════════════════════════════════════════════
-- MIGRATION 0017 : SOCLE DU WORKFLOW COMPLET
--
-- Cette migration pose la FONDATION de tout le reste. Elle ne
-- produit aucun écran, aucun bouton : elle rend possibles les
-- mécanismes décrits par l'exploitant.
--
-- ── CE QUELLE DÉBLOQUE, POINT PAR POINT ──
--
-- 1. MOBILIX passe à DEUX ateliers (découpe bois / tapissage).
--    Le modèle d'usine est désormais complet :
--      ADMEDCO : A1 tôle · A2 bureau · A3 poudrage+emballage
--      MOBILIX : M1 découpe bois · M2 tapissage
--
-- 2. CORRECTION STRUCTURANTE — l'unicité des étapes.
--    `work_order_steps` était UNIQUE(item_id, step_order). Or une
--    pièce traverse PLUSIEURS ateliers qui numérotent CHACUN à
--    partir de 1 : elle ne peut donc pas avoir deux « étape 5 ».
--    Le parcours réel (A1 → A3 poudrage → A2 montage → A3
--    emballage) était INREPRÉSENTABLE.
--    On ajoute `sequence` : un ordre GLOBAL, continu, unique par
--    pièce. `step_order` redevient ce qu'il aurait toujours dû
--    être — le numéro d'étape PROPRE À L'ATELIER, pour l'affichage.
--
-- 3. L'ouvrier déclare, à chaque étape : PRIS / RÉUSSI / PERDU.
--
-- 4. La matière première est RÉSERVÉE, jamais retirée d'office.
--    On trace le prélèvement réel à part de la réservation.
--
-- 5. Chaque atelier a son stock en-cours, où l'on PARQUE un
--    travail commencé quand une commande urgente arrive.
--
-- 6. La DETTE DE PRODUCTION : le manque sous le seuil bas n'est
--    pas produit sur-le-champ, il est reporté sur la commande
--    suivante (système de récupération 200/300).
--
-- 7. Le RENDEMENT MATIÈRE : combien une unité de matière donne
--    de pièces (une barre → 4 pièces). Les valeurs seront saisies
--    plus tard ; la table les attend.
--
-- 8. La COMMANDE CLIENT : lien portail, saisie admin, lignes.
--
-- 9. Le TRIAGE : une commande client se scinde en sous-commandes
--    par usine, sans jamais mélanger les deux jeux de documents.
--
-- 10. La JOURNÉE OUVRIER et ses QR codes, le TEMPS passé par
--     ouvrier et par poste — le socle du classement.
--
-- ⚠️ AUCUNE DONNÉE DE DÉMONSTRATION N'EST INSÉRÉE ICI.
--    Le référentiel (rendements, seuils) sera saisi par
--    l'exploitant. Les tables sont créées VIDES.
--
-- À exécuter APRÈS 0016. Ré-exécutable, idempotent.
-- ═══════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ═══════════════════════════════════════════════════════════
-- 1. MOBILIX — DEUX ATELIERS
-- ═══════════════════════════════════════════════════════════
-- L'id 3 (M1) existe depuis 0012 et porte déjà de l'historique de
-- production : on le RÉÉTIQUETTE, on ne le recrée pas. Le second
-- atelier prend l'id 5 — 4 est pris par A3 depuis 0016.
--
-- ⚠️ Ne jamais réattribuer un id d'atelier existant : cela
--    réécrirait `atelier_id` sur tout l'historique (work_order_steps,
--    process_templates, semi_finished_stock, profiles). 0008 l'a fait
--    une fois, on ne le refait pas.

INSERT INTO ateliers(id, code, name, site) VALUES
(5, 'M2', 'Atelier MOBILIX 2 — Tapissage', 'MOBILIX')
ON CONFLICT (id) DO NOTHING;

UPDATE ateliers SET name = 'Atelier MOBILIX 1 — Découpe bois'
  WHERE id = 3 AND code = 'M1';
UPDATE ateliers SET name = 'Atelier MOBILIX 2 — Tapissage'
  WHERE id = 5 AND code = 'M2';

INSERT INTO erp_depots(code, nom, atelier_id) VALUES
('DEP-M2', 'Dépôt Atelier MOBILIX 2 — Tapissage', 5)
ON CONFLICT (code) DO NOTHING;

UPDATE erp_depots SET nom = 'Dépôt Atelier MOBILIX 1 — Découpe bois'
  WHERE code = 'DEP-M1';

-- ── Type de chaque dépôt ──
-- Permet d'appliquer les règles de seuil et de parcage au bon
-- endroit sans les coder en dur dans l'application.
ALTER TABLE erp_depots ADD COLUMN IF NOT EXISTS type_depot TEXT DEFAULT 'ATELIER';
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='erp_depots'::regclass
             AND conname='erp_depots_type_depot_check') THEN
    ALTER TABLE erp_depots DROP CONSTRAINT erp_depots_type_depot_check;
  END IF;
  ALTER TABLE erp_depots ADD CONSTRAINT erp_depots_type_depot_check
    CHECK (type_depot IN ('MP','EN_COURS','SOUS_STOCK','FINAL','PF','ATELIER'));
END $$;

UPDATE erp_depots SET type_depot = 'MP'         WHERE atelier_id IS NULL AND code LIKE 'DEP-MP%';
UPDATE erp_depots SET type_depot = 'SOUS_STOCK' WHERE code IN ('DEP-A1','DEP-A2','DEP-M1','DEP-M2');
UPDATE erp_depots SET type_depot = 'FINAL'      WHERE code = 'DEP-A3';
UPDATE erp_depots SET type_depot = 'PF'         WHERE code = 'DEP-PF';

-- ── Dépôts en-cours (parcage), un par site ──
INSERT INTO erp_depots(code, nom, atelier_id, type_depot) VALUES
('DEP-ENCOURS-ADM', 'En-cours parcé — ADMEDCO', NULL, 'EN_COURS'),
('DEP-ENCOURS-MBX', 'En-cours parcé — MOBILIX', NULL, 'EN_COURS')
ON CONFLICT (code) DO NOTHING;

-- ═══════════════════════════════════════════════════════════
-- 2. L'ORDRE GLOBAL DES ÉTAPES — correction structurante
-- ═══════════════════════════════════════════════════════════
ALTER TABLE work_order_steps ADD COLUMN IF NOT EXISTS sequence NUMERIC DEFAULT 0;

-- Rattrapage des lignes existantes : ordre déterministe, atelier
-- puis étape. Ce n'est PAS la route exacte d'un produit (elle est
-- définie par la gamme dans le code) — c'est un ordre de départ
-- cohérent pour l'historique déjà en base.
WITH ord AS (
  SELECT id,
         row_number() OVER (PARTITION BY item_id
                            ORDER BY atelier_id, step_order, id) * 10 AS seq
  FROM work_order_steps
  WHERE sequence IS NULL OR sequence = 0
)
UPDATE work_order_steps s SET sequence = ord.seq
FROM ord WHERE s.id = ord.id;

-- Attribution automatique : les insertions existantes du code
-- (actions-usines.ts) ne renseignent pas `sequence`. Sans ce
-- déclencheur, elles violeraient la nouvelle clé d'unicité.
CREATE OR REPLACE FUNCTION assign_step_sequence() RETURNS trigger AS $$
BEGIN
  IF NEW.sequence IS NULL OR NEW.sequence = 0 THEN
    SELECT COALESCE(MAX(sequence), 0) + 10 INTO NEW.sequence
    FROM work_order_steps WHERE item_id = NEW.item_id;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_step_sequence ON work_order_steps;
CREATE TRIGGER trg_step_sequence BEFORE INSERT ON work_order_steps
FOR EACH ROW EXECUTE FUNCTION assign_step_sequence();

-- Retrait de l'ancienne unicité (item_id, step_order)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='work_order_steps'::regclass
             AND conname='work_order_steps_item_id_step_order_key') THEN
    ALTER TABLE work_order_steps DROP CONSTRAINT work_order_steps_item_id_step_order_key;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='work_order_steps'::regclass
                 AND conname='work_order_steps_item_id_sequence_key') THEN
    ALTER TABLE work_order_steps
      ADD CONSTRAINT work_order_steps_item_id_sequence_key UNIQUE (item_id, sequence);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_steps_item_seq   ON work_order_steps(item_id, sequence);
CREATE INDEX IF NOT EXISTS idx_steps_atelier    ON work_order_steps(atelier_id, status);

-- Même correction sur les gabarits de gamme : une catégorie peut
-- avoir des étapes dans plusieurs ateliers, chacune numérotée
-- depuis 1. Sans atelier_id dans la clé, impossible.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='process_templates'::regclass
             AND conname='process_templates_category_id_step_order_key') THEN
    ALTER TABLE process_templates DROP CONSTRAINT process_templates_category_id_step_order_key;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='process_templates'::regclass
                 AND conname='process_templates_category_id_atelier_id_step_order_key') THEN
    ALTER TABLE process_templates
      ADD CONSTRAINT process_templates_category_id_atelier_id_step_order_key
      UNIQUE (category_id, atelier_id, step_order);
  END IF;
END $$;

-- ── Conséquence directe : le calcul de l'atelier courant ──
-- La version de 0005 ordonnait les étapes par `step_order`. Avec
-- plusieurs ateliers qui numérotent chacun à partir de 1, cet ordre
-- ne classe plus rien : l'atelier affiché serait faux.
-- On le réécrit sur `sequence`. Même correction pour la création de
-- la ligne de semi-fini : sans garde, chaque mise à jour d'étape
-- après la dernière en insérait une nouvelle (le ON CONFLICT
-- DO NOTHING de 0005 ne bloquait rien — la table n'a aucune clé
-- d'unicité).
CREATE OR REPLACE FUNCTION update_item_progress() RETURNS trigger AS $$
DECLARE
  total_ct INT;
  done_ct INT;
  dernier_atelier SMALLINT;
BEGIN
  SELECT count(*), count(*) FILTER (where status = 'DONE')
  INTO total_ct, done_ct
  FROM work_order_steps WHERE item_id = NEW.item_id;

  SELECT atelier_id INTO dernier_atelier
  FROM work_order_steps
  WHERE item_id = NEW.item_id AND status = 'ACTIVE'
  ORDER BY sequence DESC LIMIT 1;

  UPDATE work_order_items SET
    steps_completed = done_ct,
    steps_total = total_ct,
    status = CASE
      WHEN done_ct = 0 THEN 'CREATED'
      WHEN done_ct < total_ct THEN 'IN_PROGRESS'
      ELSE 'SEMI_READY'
    END,
    current_atelier_id = COALESCE(dernier_atelier, current_atelier_id)
  WHERE id = NEW.item_id;

  IF done_ct = total_ct AND total_ct > 0 THEN
    INSERT INTO semi_finished_stock (item_id, atelier_id, quantity)
    SELECT NEW.item_id,
           (SELECT atelier_id FROM work_order_steps
            WHERE item_id = NEW.item_id ORDER BY sequence DESC LIMIT 1),
           (SELECT quantity FROM work_order_items WHERE id = NEW.item_id)
    WHERE NOT EXISTS (
      SELECT 1 FROM semi_finished_stock s2
      WHERE s2.item_id = NEW.item_id
        AND s2.atelier_id = (SELECT atelier_id FROM work_order_steps
                             WHERE item_id = NEW.item_id
                             ORDER BY sequence DESC LIMIT 1)
    );
  END IF;

  RETURN NEW;
END; $$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════
-- 3. DÉCLARATION OUVRIER — PRIS / RÉUSSI / PERDU
-- ═══════════════════════════════════════════════════════════
-- `quantity_ok` existe depuis 0012. On ajoute les deux autres.
--   quantity_taken : ce que l'ouvrier a PRIS (matière ou pièces
--                    entrant dans l'étape)
--   quantity_ok    : ce qui a RÉUSSI
--   quantity_rebut : ce qui est PERDU
ALTER TABLE work_order_steps ADD COLUMN IF NOT EXISTS quantity_taken NUMERIC DEFAULT 0;
ALTER TABLE work_order_steps ADD COLUMN IF NOT EXISTS quantity_rebut NUMERIC DEFAULT 0;

-- ═══════════════════════════════════════════════════════════
-- 4. RÉSERVATION MATIÈRE — réserver n'est pas retirer
-- ═══════════════════════════════════════════════════════════
-- `order_item_reservations` (0005) porte déjà la réservation.
-- On la complète : origine de l'article, rendement appliqué, et
-- l'écart entre le réservé et le réellement prélevé.
ALTER TABLE order_item_reservations ADD COLUMN IF NOT EXISTS article_id UUID REFERENCES erp_articles(id);
ALTER TABLE order_item_reservations ADD COLUMN IF NOT EXISTS depot_code TEXT;
ALTER TABLE order_item_reservations ADD COLUMN IF NOT EXISTS rendement_applique NUMERIC DEFAULT 1;
ALTER TABLE order_item_reservations ADD COLUMN IF NOT EXISTS prise_qty NUMERIC DEFAULT 0;
ALTER TABLE order_item_reservations ADD COLUMN IF NOT EXISTS statut TEXT DEFAULT 'RESERVEE';
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='order_item_reservations'::regclass
             AND conname='order_item_reservations_statut_check') THEN
    ALTER TABLE order_item_reservations DROP CONSTRAINT order_item_reservations_statut_check;
  END IF;
  ALTER TABLE order_item_reservations ADD CONSTRAINT order_item_reservations_statut_check
    CHECK (statut IN ('RESERVEE','PARTIELLE','CONSOMMEE','LIBEREE'));
END $$;

-- ═══════════════════════════════════════════════════════════
-- 5. LE PARCAGE — en-cours par atelier
-- ═══════════════════════════════════════════════════════════
-- Quand une commande lourde arrive, on arrête celle en cours à
-- l'étape où elle est arrivée, on la laisse là, et on la reprend
-- plus tard. Le rattachement se fait à L'ÉTAPE, pas à l'atelier
-- seul : sinon on ne sait pas où reprendre.
ALTER TABLE semi_finished_stock ADD COLUMN IF NOT EXISTS step_id UUID REFERENCES work_order_steps(id) ON DELETE SET NULL;
ALTER TABLE semi_finished_stock ADD COLUMN IF NOT EXISTS depot_code TEXT;
ALTER TABLE semi_finished_stock ADD COLUMN IF NOT EXISTS quantite_ok NUMERIC DEFAULT 0;
ALTER TABLE semi_finished_stock ADD COLUMN IF NOT EXISTS quantite_rebut NUMERIC DEFAULT 0;
ALTER TABLE semi_finished_stock ADD COLUMN IF NOT EXISTS motif TEXT DEFAULT '';
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='semi_finished_stock'::regclass
             AND conname='semi_finished_stock_status_check') THEN
    ALTER TABLE semi_finished_stock DROP CONSTRAINT semi_finished_stock_status_check;
  END IF;
  ALTER TABLE semi_finished_stock ADD CONSTRAINT semi_finished_stock_status_check
    CHECK (status IN ('PENDING','EN_COURS','PARQUE','RELEASED','TRANSFERRED'));
END $$;
CREATE INDEX IF NOT EXISTS idx_semi_step ON semi_finished_stock(step_id);

-- Journal des parcages : qui a parqué quoi, pour quelle urgence,
-- et quand on a repris.
CREATE TABLE IF NOT EXISTS parcages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id UUID NOT NULL REFERENCES work_order_steps(id) ON DELETE CASCADE,
  atelier_id SMALLINT REFERENCES ateliers(id),
  quantity NUMERIC NOT NULL DEFAULT 0,
  depot_code TEXT DEFAULT 'DEP-ENCOURS-ADM',
  commande_urgente_id UUID REFERENCES work_orders(id),
  motif TEXT DEFAULT '',
  statut TEXT NOT NULL DEFAULT 'PARQUE' CHECK (statut IN ('PARQUE','REPRIS')),
  parque_at TIMESTAMPTZ DEFAULT now(),
  repris_at TIMESTAMPTZ,
  repris_par UUID REFERENCES profiles(id)
);
CREATE INDEX IF NOT EXISTS idx_parcages_statut ON parcages(statut, atelier_id);

-- ═══════════════════════════════════════════════════════════
-- 6. SEUILS DE STOCK — minimum 200 / maximum 300
-- ═══════════════════════════════════════════════════════════
-- `stock_items` porte déjà `depot_code` : une ligne = un article
-- dans un dépôt. Les seuils se posent donc ici, article par
-- article — c'est le propriétaire qui les renseignera.
--
-- ⚠️ NULL par défaut, et non 200/300 : la matière première n'a
--    pas de plancher de 200, seul le produit fabriqué en a un.
--    Poser une valeur par défaut appliquerait la règle au mauvais
--    périmètre.
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS min_qty NUMERIC;
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS max_qty NUMERIC;

-- Vue : les sous-stocks et stocks finaux sous leur plancher.
-- C'est cette liste qui déclenche la dette de production.
CREATE OR REPLACE VIEW v_stocks_sous_seuil AS
SELECT
  s.id, s.code, s.name, s.depot_code, s.usine_code,
  s.quantity, s.min_qty, s.max_qty,
  COALESCE(r.reserved, 0) AS reserved,
  s.quantity - COALESCE(r.reserved, 0) AS available,
  GREATEST(0, COALESCE(s.min_qty, 0) - (s.quantity - COALESCE(r.reserved, 0))) AS manque
FROM stock_items s
LEFT JOIN (
  SELECT oir.stock_item_id, SUM(oir.estimated_qty - oir.consumed_qty) AS reserved
  FROM order_item_reservations oir
  JOIN work_order_items woi ON woi.id = oir.order_item_id
  WHERE woi.status NOT IN ('RELEASED','CANCELLED')
  GROUP BY oir.stock_item_id
) r ON r.stock_item_id = s.id
WHERE s.min_qty IS NOT NULL;

-- ═══════════════════════════════════════════════════════════
-- 7. LA DETTE DE PRODUCTION — le système de récupération
-- ═══════════════════════════════════════════════════════════
-- Le sous-stock ne doit pas descendre sous son plancher. Si une
-- sortie l'y ferait descendre, le manque n'est PAS produit
-- sur-le-champ : il est enregistré ici et absorbé par la
-- commande suivante.
--
--   sous-stock 500 − commande 350 = 150   (plancher 200)
--   manque = 50  → enregistré, non produit
--   commande suivante 400 → on produit 450
CREATE TABLE IF NOT EXISTS dette_production (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usine_code TEXT NOT NULL DEFAULT 'ADMEDCO' REFERENCES usines(code),
  atelier_id SMALLINT REFERENCES ateliers(id),
  article_id UUID REFERENCES erp_articles(id),
  stock_item_id UUID REFERENCES stock_items(id) ON DELETE SET NULL,
  depot_code TEXT,
  qty_due NUMERIC NOT NULL CHECK (qty_due > 0),
  commande_origine_id UUID REFERENCES work_orders(id),
  statut TEXT NOT NULL DEFAULT 'OUVERTE' CHECK (statut IN ('OUVERTE','ABSORBEE','ANNULEE')),
  absorbee_par_id UUID REFERENCES work_orders(id),
  cree_at TIMESTAMPTZ DEFAULT now(),
  absorbe_at TIMESTAMPTZ,
  note TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_dette_ouverte ON dette_production(statut, usine_code, atelier_id);

CREATE OR REPLACE VIEW v_dette_par_article AS
SELECT usine_code, atelier_id, article_id, depot_code,
       SUM(qty_due) AS qty_due_totale,
       COUNT(*) AS nb_lignes,
       MIN(cree_at) AS plus_ancienne
FROM dette_production
WHERE statut = 'OUVERTE'
GROUP BY usine_code, atelier_id, article_id, depot_code;

-- ═══════════════════════════════════════════════════════════
-- 8. RENDEMENT MATIÈRE — ce qu'une unité de matière produit
-- ═══════════════════════════════════════════════════════════
-- « Une seule tôle / un seul tube donne combien de pièces. »
-- C'est ce calcul qui fait le pont entre « 300 chaises » et
-- « combien de barres je sors du stock ».
--
-- ⚠️ Table VOLONTAIREMENT VIDE. Les valeurs seront fournies par
--    l'exploitant, usine par usine. Tant qu'une ligne manque,
--    l'agent considère un rendement de 1 (1 pour 1) et le signale
--    comme « rendement non renseigné » — il n'invente rien.
CREATE TABLE IF NOT EXISTS rendement_matiere (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usine_code TEXT NOT NULL DEFAULT 'ADMEDCO' REFERENCES usines(code),
  article_id UUID NOT NULL REFERENCES erp_articles(id),
  produit_id UUID REFERENCES erp_articles(id),
  unites_produites NUMERIC NOT NULL DEFAULT 1 CHECK (unites_produites > 0),
  unite_matiere TEXT DEFAULT 'pcs',
  unite_produit TEXT DEFAULT 'pcs',
  note TEXT DEFAULT '',
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_rendement
  ON rendement_matiere(usine_code, article_id, COALESCE(produit_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- ═══════════════════════════════════════════════════════════
-- 9. LA COMMANDE CLIENT — portail et saisie admin
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS commandes_client (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT UNIQUE NOT NULL,
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  token_expire_at TIMESTAMPTZ,
  tiers_id UUID REFERENCES erp_tiers(id),
  client_nom TEXT NOT NULL,
  client_telephone TEXT DEFAULT '',
  client_email TEXT DEFAULT '',
  client_adresse TEXT DEFAULT '',
  origine TEXT NOT NULL DEFAULT 'SAISIE_ADMIN'
    CHECK (origine IN ('PORTAIL_CLIENT','SAISIE_ADMIN')),
  statut TEXT NOT NULL DEFAULT 'BROUILLON'
    CHECK (statut IN ('BROUILLON','RECUE','TRIEE','EN_PRODUCTION','PARTIELLE','PRETE','LIVREE','ANNULEE')),
  devis_pdf TEXT,
  note TEXT DEFAULT '',
  total_estime NUMERIC DEFAULT 0,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cmd_client_statut ON commandes_client(statut, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cmd_client_token  ON commandes_client(token);

CREATE TABLE IF NOT EXISTS commande_client_lignes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commande_id UUID NOT NULL REFERENCES commandes_client(id) ON DELETE CASCADE,
  article_id UUID REFERENCES erp_articles(id),
  designation TEXT NOT NULL DEFAULT '',
  quantite NUMERIC NOT NULL CHECK (quantite > 0),
  prix_unitaire NUMERIC DEFAULT 0,
  ligne_ordre INT NOT NULL DEFAULT 1,
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cmd_lignes ON commande_client_lignes(commande_id);

-- ═══════════════════════════════════════════════════════════
-- 10. LE TRIAGE — une commande, deux usines
-- ═══════════════════════════════════════════════════════════
-- Une chaise = une part ADMEDCO (le dur) + une part MOBILIX
-- (le mou). Le triage produit une sous-commande par usine,
-- rattachée à la même commande client — les deux jeux de
-- documents restent séparés, mais reliés.
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS commande_client_id UUID REFERENCES commandes_client(id) ON DELETE SET NULL;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS commande_client_ligne_id UUID REFERENCES commande_client_lignes(id) ON DELETE SET NULL;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS role_triage TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS atelier_demande_id SMALLINT REFERENCES ateliers(id);
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='work_orders'::regclass
             AND conname='work_orders_role_triage_check') THEN
    ALTER TABLE work_orders DROP CONSTRAINT work_orders_role_triage_check;
  END IF;
  ALTER TABLE work_orders ADD CONSTRAINT work_orders_role_triage_check
    CHECK (role_triage IS NULL OR role_triage IN ('DUR','MOU','MONTAGE','FINITION'));
END $$;

-- `category_id` était NOT NULL : une commande réelle vise un
-- ARTICLE (erp_articles), pas une catégorie de démonstration.
-- `article_id` a été ajouté en 0015 ; on lève la contrainte.
ALTER TABLE work_order_items ALTER COLUMN category_id DROP NOT NULL;
ALTER TABLE work_order_items ADD COLUMN IF NOT EXISTS role_triage TEXT;
ALTER TABLE work_order_items ADD COLUMN IF NOT EXISTS destination TEXT;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='work_order_items'::regclass
             AND conname='work_order_items_destination_check') THEN
    ALTER TABLE work_order_items DROP CONSTRAINT work_order_items_destination_check;
  END IF;
  ALTER TABLE work_order_items ADD CONSTRAINT work_order_items_destination_check
    CHECK (destination IS NULL OR destination IN ('MOBILIX','CLIENT_DIRECT','STOCK_PF'));
END $$;
CREATE INDEX IF NOT EXISTS idx_woi_article ON work_order_items(article_id);

-- ═══════════════════════════════════════════════════════════
-- 11. LA JOURNÉE OUVRIER ET LES QR CODES
-- ═══════════════════════════════════════════════════════════
-- Deux QR codes par ouvrier :
--   qr_journee   → « ma journée » : l'ouvrier scanne et voit tout
--                  son travail du jour (ordre défini par l'admin)
--   (entrée/sortie) → contrôle d'entrée et de sortie de
--                  production, scanné à la PREMIÈRE et à la
--                  DERNIÈRE opération seulement
--
-- ⚠️ Les QR sont régénérés CHAQUE JOUR : ce sont des jetons à
--    usage quotidien, révocables, pas des identifiants permanents.
CREATE TABLE IF NOT EXISTS journees_ouvrier (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jour DATE NOT NULL,
  worker_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  atelier_id SMALLINT REFERENCES ateliers(id),
  qr_journee TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  qr_entree  TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  arrivee_at TIMESTAMPTZ,
  depart_at  TIMESTAMPTZ,
  genere_at  TIMESTAMPTZ DEFAULT now(),
  genere_par UUID REFERENCES profiles(id),
  UNIQUE (jour, worker_id)
);
CREATE INDEX IF NOT EXISTS idx_journees_jour ON journees_ouvrier(jour DESC);

-- Affectation nominative d'une étape à un ouvrier, avec son temps.
-- C'est la table qui rend le classement possible : elle sait QUI a
-- travaillé, SUR QUOI, DANS QUEL ATELIER, COMBIEN DE TEMPS, et
-- avec quel résultat. Indispensable parce que les ouvriers sont
-- polyvalents et changent de poste chaque jour.
CREATE TABLE IF NOT EXISTS affectations_etape (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id UUID NOT NULL REFERENCES work_order_steps(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES profiles(id),
  atelier_id SMALLINT REFERENCES ateliers(id),
  journee_id UUID REFERENCES journees_ouvrier(id) ON DELETE SET NULL,
  ordre_du_jour INT,
  debut_at TIMESTAMPTZ,
  fin_at TIMESTAMPTZ,
  duree_secondes NUMERIC,
  pause_secondes NUMERIC DEFAULT 0,
  quantite_prise NUMERIC DEFAULT 0,
  quantite_ok NUMERIC DEFAULT 0,
  quantite_rebut NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_affect_worker ON affectations_etape(worker_id, debut_at DESC);
CREATE INDEX IF NOT EXISTS idx_affect_step   ON affectations_etape(step_id);
CREATE INDEX IF NOT EXISTS idx_affect_jour   ON affectations_etape(journee_id, ordre_du_jour);

-- Le temps réel se calcule au lieu d'être saisi : on soustrait
-- les pauses, sinon un ouvrier qui parque et reprend serait
-- pénalisé.
CREATE OR REPLACE FUNCTION calc_duree_affectation() RETURNS trigger AS $$
BEGIN
  IF NEW.debut_at IS NOT NULL AND NEW.fin_at IS NOT NULL THEN
    NEW.duree_secondes := GREATEST(0,
      extract(epoch from (NEW.fin_at - NEW.debut_at)) - COALESCE(NEW.pause_secondes, 0));
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_duree_affectation ON affectations_etape;
CREATE TRIGGER trg_duree_affectation BEFORE INSERT OR UPDATE ON affectations_etape
FOR EACH ROW EXECUTE FUNCTION calc_duree_affectation();

-- ═══════════════════════════════════════════════════════════
-- 12. VUES DE PILOTAGE
-- ═══════════════════════════════════════════════════════════

-- Bilan de la journée : ce qui est entré, sorti, réussi, perdu.
CREATE OR REPLACE VIEW v_bilan_journalier AS
SELECT
  j.jour,
  j.atelier_id,
  a.code  AS atelier_code,
  a.name  AS atelier_nom,
  COUNT(DISTINCT j.worker_id)                 AS nb_ouvriers,
  COALESCE(SUM(f.quantite_prise), 0)          AS qty_prise,
  COALESCE(SUM(f.quantite_ok), 0)             AS qty_ok,
  COALESCE(SUM(f.quantite_rebut), 0)          AS qty_rebut,
  COALESCE(SUM(f.duree_secondes), 0)          AS secondes_travail,
  CASE WHEN COALESCE(SUM(f.quantite_ok + f.quantite_rebut), 0) > 0
       THEN ROUND(100.0 * SUM(f.quantite_ok)
                  / SUM(f.quantite_ok + f.quantite_rebut), 2)
       ELSE NULL END                          AS taux_reussite
FROM journees_ouvrier j
LEFT JOIN affectations_etape f ON f.journee_id = j.id
LEFT JOIN ateliers a ON a.id = j.atelier_id
GROUP BY j.jour, j.atelier_id, a.code, a.name;

-- Classement par ouvrier — ADMIN SEULEMENT (voir RLS plus bas).
-- Croise le volume produit, le taux de réussite et l'écart au
-- temps estimé. Un ouvrier qui produit beaucoup mais casse
-- beaucoup ne remonte pas ; un ouvrier rapide mais imprécis non
-- plus.
CREATE OR REPLACE VIEW v_classement_ouvrier AS
SELECT
  p.id AS worker_id,
  p.full_name,
  f.atelier_id,
  a.code AS atelier_code,
  COUNT(*) FILTER (WHERE f.fin_at IS NOT NULL)              AS etapes_terminees,
  COALESCE(SUM(f.quantite_ok), 0)                           AS qty_ok,
  COALESCE(SUM(f.quantite_rebut), 0)                        AS qty_rebut,
  CASE WHEN COALESCE(SUM(f.quantite_ok + f.quantite_rebut), 0) > 0
       THEN ROUND(100.0 * SUM(f.quantite_ok)
                  / SUM(f.quantite_ok + f.quantite_rebut), 2)
       ELSE NULL END                                        AS taux_reussite,
  COALESCE(SUM(f.duree_secondes), 0) / 60.0                 AS minutes_travail,
  COALESCE(SUM(s.estimated_minutes), 0)                     AS minutes_estimees
FROM affectations_etape f
JOIN profiles p  ON p.id = f.worker_id
JOIN work_order_steps s ON s.id = f.step_id
LEFT JOIN ateliers a ON a.id = f.atelier_id
GROUP BY p.id, p.full_name, f.atelier_id, a.code;

-- Où en est chaque pièce, dans l'ordre GLOBAL de sa route.
CREATE OR REPLACE VIEW v_avancement_piece AS
SELECT
  s.item_id,
  s.id AS step_id,
  s.sequence,
  s.step_order,
  s.atelier_id,
  a.code AS atelier_code,
  s.step_name,
  s.status,
  s.quantity_taken,
  s.quantity_ok,
  s.quantity_rebut,
  s.estimated_minutes,
  s.actual_minutes
FROM work_order_steps s
LEFT JOIN ateliers a ON a.id = s.atelier_id
ORDER BY s.item_id, s.sequence;

-- ═══════════════════════════════════════════════════════════
-- 13. RLS ET DROITS
-- ═══════════════════════════════════════════════════════════
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'parcages','dette_production','rendement_matiere',
    'commandes_client','commande_client_lignes',
    'journees_ouvrier','affectations_etape'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "auth read all" ON %I', t);
    EXECUTE format('CREATE POLICY "auth read all" ON %I FOR SELECT TO authenticated USING (true)', t);
    EXECUTE format('DROP POLICY IF EXISTS "admin write all" ON %I', t);
    EXECUTE format('CREATE POLICY "admin write all" ON %I FOR ALL TO authenticated USING (exists(select 1 from profiles p where p.id = auth.uid() and p.role = %L)) WITH CHECK (exists(select 1 from profiles p where p.id = auth.uid() and p.role = %L))', t, 'ADMIN', 'ADMIN');
  END LOOP;
END $$;

-- Le portail client lit SA commande via le jeton, sans compte.
-- L'accès se fait par le service_role côté serveur (route Next.js),
-- jamais directement par le navigateur : aucune policy anon n'est
-- créée ici, volontairement.

-- Droits génériques d'abord : le REVOKE du classement, plus bas,
-- doit passer APRÈS eux, sinon ce GRANT le ré-ouvrirait.
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;

-- ── Le classement est retiré des rôles publics ──
-- ⚠️ Une vue Postgres ne respecte PAS la RLS de ses tables
--    sous-jacentes (sauf `security_invoker`, PG 15+). Poser une
--    policy « admin » sur `affectations_etape` ne suffirait donc
--    pas : n'importe quel compte authentifié lirait le classement
--    par la vue. On coupe l'accès à la vue elle-même et on laisse
--    le `service_role` la lire — l'action serveur, elle, vérifie
--    le rôle ADMIN avant de la consulter.
--
-- ⚠️ Cet ordre est volontaire : le GRANT ALL ci-dessus vient de
--    rouvrir la vue à `anon` et `authenticated`. Ce REVOKE est donc
--    la DERNIÈRE instruction du fichier — ne rien ajouter après lui
--    qui accorderait des droits sur les tables du schéma public.
REVOKE ALL ON v_classement_ouvrier FROM anon, authenticated;
GRANT SELECT ON v_classement_ouvrier TO service_role;
