alter table ateliers enable row level security;
alter table profiles enable row level security;
alter table product_categories enable row level security;
alter table process_templates enable row level security;
alter table work_orders enable row level security;
alter table work_order_steps enable row level security;
alter table material_logs enable row level security;
alter table site_transfers enable row level security;

drop policy if exists "auth read all" on ateliers;
create policy "auth read all" on ateliers for select to authenticated using (true);
drop policy if exists "auth read all" on product_categories;
create policy "auth read all" on product_categories for select to authenticated using (true);
drop policy if exists "auth read all" on process_templates;
create policy "auth read all" on process_templates for select to authenticated using (true);
drop policy if exists "auth read all" on work_orders;
create policy "auth read all" on work_orders for select to authenticated using (true);
drop policy if exists "auth read all" on work_order_steps;
create policy "auth read all" on work_order_steps for select to authenticated using (true);
drop policy if exists "auth read all" on material_logs;
create policy "auth read all" on material_logs for select to authenticated using (true);
drop policy if exists "auth read all" on site_transfers;
create policy "auth read all" on site_transfers for select to authenticated using (true);

drop policy if exists "admin write orders" on work_orders;
create policy "admin write orders" on work_orders for all to authenticated
using (exists(select 1 from profiles p where p.id = auth.uid() and p.role = 'ADMIN'))
with check (exists(select 1 from profiles p where p.id = auth.uid() and p.role = 'ADMIN'));

drop policy if exists "admin write templates" on process_templates;
create policy "admin write templates" on process_templates for all to authenticated
using (exists(select 1 from profiles p where p.id = auth.uid() and p.role = 'ADMIN'))
with check (exists(select 1 from profiles p where p.id = auth.uid() and p.role = 'ADMIN'));

drop policy if exists "worker update own atelier steps" on work_order_steps;
create policy "worker update own atelier steps" on work_order_steps for update to authenticated
using (exists(select 1 from profiles p where p.id = auth.uid()
  and (p.role = 'ADMIN' or p.atelier_id = work_order_steps.atelier_id)));

drop policy if exists "worker insert steps" on work_order_steps;
create policy "worker insert steps" on work_order_steps for insert to authenticated with check (true);

drop policy if exists "worker insert logs" on material_logs;
create policy "worker insert logs" on material_logs for insert to authenticated with check (true);

drop policy if exists "worker manage transfers" on site_transfers;
create policy "worker manage transfers" on site_transfers for all to authenticated
using (true) with check (true);

drop policy if exists "profiles self" on profiles;
create policy "profiles self" on profiles for select to authenticated
using (id = auth.uid() or exists(select 1 from profiles p where p.id = auth.uid() and p.role = 'ADMIN'));

-- actual_minutes auto calc
create or replace function calc_actual_minutes() returns trigger as $$
begin
  if NEW.started_at is not null and NEW.completed_at is not null then
    NEW.actual_minutes := greatest(0, extract(epoch from (NEW.completed_at - NEW.started_at)) / 60.0);
  end if;
  return NEW;
end; $$ language plpgsql;

drop trigger if exists trg_actual on work_order_steps;
create trigger trg_actual before insert or update on work_order_steps
for each row execute function calc_actual_minutes();

-- propagate order status
create or replace function propagate_order_status() returns trigger as $$
declare done_ct int; total_ct int;
begin
  select count(*), count(*) filter (where status = 'DONE')
  into total_ct, done_ct
  from work_order_steps where work_order_id = NEW.work_order_id;
  update work_orders set status = case
    when done_ct = 0 then 'IN_PROGRESS'
    when done_ct < total_ct then 'IN_PROGRESS'
    else 'COMPLETED' end
  where id = NEW.work_order_id;
  return NEW;
end; $$ language plpgsql;

drop trigger if exists trg_propagate on work_order_steps;
create trigger trg_propagate after insert or update on work_order_steps
for each row execute function propagate_order_status();

-- variance + yield view
create or replace view v_step_variance as
select s.*,
  (s.actual_minutes - s.estimated_minutes) as variance_min,
  (s.actual_minutes > s.estimated_minutes) as is_overdue,
  case when s.expected_units > 0 then s.good_units::numeric / nullif(s.expected_units, 0) else null end as yield_coeff,
  case when (s.good_units + s.scrap_units) > 0
    then s.scrap_units::numeric / (s.good_units + s.scrap_units) * 100 else 0 end as scrap_pct
from work_order_steps s;

-- instantiate order from template
create or replace function instantiate_work_order(p_order uuid) returns void as $$
begin
  insert into work_order_steps (work_order_id, step_order, atelier_id, step_name, estimated_minutes, expected_units)
  select p_order, t.step_order, t.atelier_id, t.step_name, t.estimated_minutes,
    (select target_quantity from work_orders where id = p_order)
  from process_templates t
  join work_orders o on o.category_id = t.category_id
  where o.id = p_order
  on conflict (work_order_id, step_order) do nothing;
end; $$ language plpgsql;
