-- Admin team management: allow ADMIN role to manage profiles via anon client.
-- Note: primary team ops use the service-role key server-side; these policies
-- keep the app functional for admin writes through the regular client too.

drop policy if exists "admin manage profiles" on profiles;
create policy "admin manage profiles" on profiles for all to authenticated
using (exists(select 1 from profiles p where p.id = auth.uid() and p.role = 'ADMIN'))
with check (exists(select 1 from profiles p where p.id = auth.uid() and p.role = 'ADMIN'));
