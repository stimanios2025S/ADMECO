-- MES/ERP schema: multi-site furniture factory
create extension if not exists "pgcrypto";

create table ateliers (
  id smallint primary key,
  code text unique not null,
  name text not null,
  site text not null
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('ADMIN','WORKER')),
  atelier_id smallint references ateliers(id),
  full_name text not null,
  created_at timestamptz default now()
);

create table product_categories (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  description text
);

create table process_templates (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references product_categories(id) on delete cascade,
  step_order int not null,
  atelier_id smallint not null references ateliers(id),
  step_name text not null,
  estimated_minutes int not null default 30,
  standard_material text default '',
  standard_qty numeric default 0,
  unique(category_id, step_order)
);

create table work_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null,
  category_id uuid not null references product_categories(id),
  status text not null default 'CREATED'
    check (status in ('CREATED','IN_PROGRESS','IN_TRANSIT','FINISHING','QC','PACKED','COMPLETED','ON_HOLD')),
  target_quantity int not null check (target_quantity > 0),
  good_quantity int default 0,
  scrap_quantity int default 0,
  created_at timestamptz default now(),
  due_at timestamptz
);

create table work_order_steps (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references work_orders(id) on delete cascade,
  step_order int not null,
  atelier_id smallint not null references ateliers(id),
  step_name text not null,
  status text not null default 'PENDING'
    check (status in ('PENDING','ACTIVE','PAUSED','DONE','REWORK','SKIPPED_SPLIT')),
  estimated_minutes int not null,
  actual_minutes numeric default 0,
  started_at timestamptz,
  paused_at timestamptz,
  completed_at timestamptz,
  worker_id uuid references profiles(id),
  qr_code_hash text unique not null default encode(gen_random_bytes(8),'hex'),
  good_units int default 0,
  expected_units int default 0,
  scrap_units int default 0,
  unique(work_order_id, step_order)
);

create table material_logs (
  id uuid primary key default gen_random_uuid(),
  step_id uuid not null references work_order_steps(id) on delete cascade,
  material_name text not null,
  quantity_used numeric not null default 0,
  quantity_lost numeric not null default 0,
  loss_reason text,
  created_at timestamptz default now()
);

create table site_transfers (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references work_orders(id) on delete cascade,
  from_atelier smallint not null references ateliers(id),
  to_atelier smallint not null references ateliers(id),
  manifest_qr text unique not null default 'MNF-'||encode(gen_random_bytes(6),'hex'),
  item_count int not null,
  verified_at timestamptz,
  status text not null default 'IN_TRANSIT'
    check (status in ('IN_TRANSIT','VERIFIED','SHORTAGE'))
);

create index idx_steps_order on work_order_steps(work_order_id, step_order);
create index idx_steps_status on work_order_steps(status);
create index idx_steps_qr on work_order_steps(qr_code_hash);
create index idx_logs_step on material_logs(step_id);
create index idx_transfers_qr on site_transfers(manifest_qr);
