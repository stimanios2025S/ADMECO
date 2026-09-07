-- ADEMCO & MOBILIX — Rebuilt schema
-- Run this AFTER 0001–0003 in Supabase SQL Editor

-- ═══════════════════════════════════════════
-- 1. STOCK ITEMS (raw materials inventory)
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS stock_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'pcs',
  quantity NUMERIC NOT NULL DEFAULT 0,
  alert_threshold NUMERIC DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════
-- 2. STOCK MOVEMENTS (audit trail: reserve / consume / release / adjust)
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_item_id UUID REFERENCES stock_items(id) ON DELETE CASCADE,
  order_item_id UUID,
  step_id UUID,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('reserve','consume','release','adjust')),
  quantity NUMERIC NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_movements_stock ON stock_movements(stock_item_id);

-- ═══════════════════════════════════════════
-- 3. PROCESS TEMPLATES (rebuilt with branching)
-- ═══════════════════════════════════════════
DROP TABLE IF EXISTS process_templates CASCADE;
CREATE TABLE process_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES product_categories(id) ON DELETE CASCADE,
  step_order NUMERIC NOT NULL,
  atelier_id SMALLINT NOT NULL REFERENCES ateliers(id),
  step_name TEXT NOT NULL,
  estimated_minutes INT NOT NULL DEFAULT 30,
  standard_materials JSONB DEFAULT '[]'::jsonb,
  has_branch BOOLEAN DEFAULT false,
  branch_insert_name TEXT,
  branch_insert_materials JSONB DEFAULT '[]'::jsonb,
  branch_insert_minutes INT DEFAULT 20,
  UNIQUE(category_id, step_order)
);

-- ═══════════════════════════════════════════
-- 4. WORK ORDERS (header only)
-- ═══════════════════════════════════════════
DROP TABLE IF EXISTS work_orders CASCADE;
CREATE TABLE work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'CREATED'
    CHECK (status IN ('CREATED','IN_PROGRESS','PARTIAL_READY','ALL_READY','RELEASED','CANCELLED')),
  created_at TIMESTAMPTZ DEFAULT now(),
  due_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id)
);

-- ═══════════════════════════════════════════
-- 5. WORK ORDER ITEMS (each product in the order)
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS work_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES product_categories(id),
  quantity INT NOT NULL CHECK (quantity > 0),
  dimensions JSONB DEFAULT '{}'::jsonb,
  design_notes TEXT DEFAULT '',
  status TEXT DEFAULT 'CREATED'
    CHECK (status IN ('CREATED','IN_PROGRESS','SEMI_READY','RELEASED','CANCELLED')),
  current_atelier_id SMALLINT REFERENCES ateliers(id),
  steps_completed INT DEFAULT 0,
  steps_total INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_items_order ON work_order_items(order_id);

-- ═══════════════════════════════════════════
-- 6. WORK ORDER STEPS (per item, with branching)
-- ═══════════════════════════════════════════
DROP TABLE IF EXISTS work_order_steps CASCADE;
CREATE TABLE work_order_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES work_order_items(id) ON DELETE CASCADE,
  step_order NUMERIC NOT NULL,
  atelier_id SMALLINT NOT NULL REFERENCES ateliers(id),
  step_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','ACTIVE','DONE','SKIPPED')),
  has_branch BOOLEAN DEFAULT false,
  branch_choice TEXT,
  estimated_minutes INT NOT NULL DEFAULT 30,
  actual_minutes NUMERIC DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  worker_id UUID REFERENCES profiles(id),
  qr_code_hash TEXT DEFAULT encode(gen_random_bytes(8),'hex'),
  UNIQUE(item_id, step_order)
);
CREATE INDEX IF NOT EXISTS idx_steps_item ON work_order_steps(item_id);
CREATE INDEX IF NOT EXISTS idx_steps_qr ON work_order_steps(qr_code_hash);
CREATE INDEX IF NOT EXISTS idx_steps_status ON work_order_steps(status);

-- ═══════════════════════════════════════════
-- 7. MATERIAL LOGS (per step — used & lost)
-- ═══════════════════════════════════════════
DROP TABLE IF EXISTS material_logs CASCADE;
CREATE TABLE material_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id UUID NOT NULL REFERENCES work_order_steps(id) ON DELETE CASCADE,
  stock_item_id UUID NOT NULL REFERENCES stock_items(id),
  quantity_used NUMERIC NOT NULL DEFAULT 0,
  quantity_lost NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_logs_step ON material_logs(step_id);

-- ═══════════════════════════════════════════
-- 8. SEMI-FINISHED STOCK (per atelier, pending admin release)
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS semi_finished_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES work_order_items(id) ON DELETE CASCADE,
  atelier_id SMALLINT NOT NULL REFERENCES ateliers(id),
  quantity INT NOT NULL,
  status TEXT DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','RELEASED','TRANSFERRED')),
  released_at TIMESTAMPTZ,
  released_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_semi_stock ON semi_finished_stock(atelier_id, status);

-- ═══════════════════════════════════════════
-- 9. SITE TRANSFERS (ADEMCO → MOBILIX)
-- ═══════════════════════════════════════════
DROP TABLE IF EXISTS site_transfers CASCADE;
CREATE TABLE site_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  manifest_qr TEXT UNIQUE NOT NULL DEFAULT 'MNF-'||encode(gen_random_bytes(6),'hex'),
  item_count INT NOT NULL,
  status TEXT DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','DELIVERED','VERIFIED')),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════
-- 10. ORDER ITEM RESERVATIONS (per order item)
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS order_item_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL REFERENCES work_order_items(id) ON DELETE CASCADE,
  stock_item_id UUID NOT NULL REFERENCES stock_items(id),
  estimated_qty NUMERIC NOT NULL,
  consumed_qty NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(order_item_id, stock_item_id)
);
CREATE INDEX IF NOT EXISTS idx_res_item ON order_item_reservations(order_item_id);

-- ═══════════════════════════════════════════
-- VIEWS
-- ═══════════════════════════════════════════
CREATE OR REPLACE VIEW v_stock_status AS
SELECT
  s.id, s.name, s.unit, s.quantity, s.alert_threshold,
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

CREATE OR REPLACE VIEW v_step_variance AS
SELECT s.*,
  (s.actual_minutes - s.estimated_minutes) AS variance_min,
  (s.actual_minutes > s.estimated_minutes) AS is_overdue
FROM work_order_steps s;

-- ═══════════════════════════════════════════
-- AUTO FUNCTIONS
-- ═══════════════════════════════════════════
CREATE OR REPLACE FUNCTION calc_actual_minutes() RETURNS trigger AS $$
BEGIN
  IF NEW.started_at IS NOT NULL AND NEW.completed_at IS NOT NULL THEN
    NEW.actual_minutes := greatest(0, extract(epoch from (NEW.completed_at - NEW.started_at)) / 60.0);
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_actual ON work_order_steps;
CREATE TRIGGER trg_actual BEFORE INSERT OR UPDATE ON work_order_steps
FOR EACH ROW EXECUTE FUNCTION calc_actual_minutes();

-- Update item progress when step completes
CREATE OR REPLACE FUNCTION update_item_progress() RETURNS trigger AS $$
DECLARE total_ct INT; done_ct INT; total_est NUMERIC; total_act NUMERIC;
BEGIN
  SELECT count(*), count(*) FILTER (where status='DONE'),
         sum(estimated_minutes), sum(actual_minutes)
  INTO total_ct, done_ct, total_est, total_act
  FROM work_order_steps WHERE item_id = NEW.item_id;

  UPDATE work_order_items SET
    steps_completed = done_ct,
    steps_total = total_ct,
    status = CASE
      WHEN done_ct = 0 THEN 'CREATED'
      WHEN done_ct < total_ct THEN 'IN_PROGRESS'
      ELSE 'SEMI_READY'
    END,
    current_atelier_id = (
      SELECT atelier_id FROM work_order_steps
      WHERE item_id = NEW.item_id AND status = 'ACTIVE'
      ORDER BY step_order DESC LIMIT 1
    )
  WHERE id = NEW.item_id;

  -- Auto-create semi-finished stock entry when all steps done
  IF done_ct = total_ct AND total_ct > 0 THEN
    INSERT INTO semi_finished_stock (item_id, atelier_id, quantity)
    SELECT NEW.item_id, (SELECT atelier_id FROM work_order_steps WHERE item_id = NEW.item_id ORDER BY step_order DESC LIMIT 1),
           (SELECT quantity FROM work_order_items WHERE id = NEW.item_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_item_progress ON work_order_steps;
CREATE TRIGGER trg_item_progress AFTER INSERT OR UPDATE ON work_order_steps
FOR EACH ROW EXECUTE FUNCTION update_item_progress();

-- Update order status based on items
CREATE OR REPLACE FUNCTION update_order_status() RETURNS trigger AS $$
DECLARE total_items INT; ready_items INT; in_progress_items INT;
BEGIN
  SELECT count(*), count(*) FILTER (where status='SEMI_READY'), count(*) FILTER (where status='IN_PROGRESS')
  INTO total_items, ready_items, in_progress_items
  FROM work_order_items WHERE order_id = NEW.order_id;

  UPDATE work_orders SET status = CASE
    WHEN ready_items = total_items AND total_items > 0 THEN 'ALL_READY'
    WHEN ready_items > 0 THEN 'PARTIAL_READY'
    WHEN in_progress_items > 0 THEN 'IN_PROGRESS'
    ELSE 'CREATED'
  END WHERE id = NEW.order_id;

  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_order_status ON work_order_items;
CREATE TRIGGER trg_order_status AFTER UPDATE ON work_order_items
FOR EACH ROW EXECUTE FUNCTION update_order_status();
