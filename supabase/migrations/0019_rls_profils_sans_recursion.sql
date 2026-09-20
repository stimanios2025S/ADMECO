-- ═══════════════════════════════════════════════════════════
-- MIGRATION 0019 : LA RÉCURSION RLS QUI BLOQUAIT TOUT L'ADMIN
--
-- ── Le symptôme ──
--
--     Chargement du catalogue impossible
--     erp_familles : infinite recursion detected in policy
--                    for relation "profiles"
--
-- ── La cause, en une phrase ──
-- Depuis 0002, une politique POSÉE SUR `profiles` interroge
-- `profiles` :
--
--     create policy "profiles self" on profiles for select
--     using (id = auth.uid()
--            or exists(select 1 from profiles p where p.id = auth.uid()
--                        and p.role = 'ADMIN'));
--
-- Pour lire `profiles`, PostgreSQL doit évaluer une condition qui
-- lit `profiles`. Il refuse de planifier et lève l'erreur. Même
-- chose pour « admin manage profiles » (0004), qui interroge aussi
-- `profiles` sur `profiles`.
--
-- ── Pourquoi TOUT l'admin tombait, pas seulement une page ──
-- Les politiques générées par 0009, 0011, 0012 et 0017 sont
-- « FOR ALL » et contiennent toutes la même sous-requête :
--
--     using (exists(select 1 from profiles p
--                   where p.id = auth.uid() and p.role = 'ADMIN'))
--
-- « FOR ALL » couvre SELECT. Donc lire la moindre table du
-- catalogue — erp_familles, erp_articles, erp_nomenclatures,
-- erp_tiers… — force l'évaluation de cette condition, qui interroge
-- `profiles`, dont les propres politiques s'auto-interrogent.
-- La récursion remonte depuis n'importe quelle table.
--
-- ── Le remède : une fonction SECURITY DEFINER ──
-- `est_admin()` lit `profiles` en tant que PROPRIÉTAIRE de la table.
-- Un propriétaire n'est pas soumis à la RLS de sa propre table :
-- la boucle est coupée net, et la règle reste exactement la même
-- (« suis-je ADMIN ? »). Aucune politique ne perd de droit.
--
-- ── Portée ──
-- Le bloc 3 parcourt `pg_policies` et réécrit TOUTE politique du
-- schéma public qui mentionne `profiles` — pas une liste de tables
-- recopiée à la main, qui serait périmée dès la prochaine migration.
-- Ce qu'il ne reconnaît pas, il le NOMME au lieu de le supprimer :
-- mieux vaut une politique intacte qu'une politique devinée.
--
-- Ré-exécutable. À exécuter AVANT de se servir de l'application.
-- ═══════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════
-- 1. LES FONCTIONS DE LECTURE DU PROFIL
-- ═══════════════════════════════════════════════════════════
-- SECURITY DEFINER : la fonction s'exécute avec les droits de son
-- propriétaire (le compte qui joue les migrations, propriétaire de
-- `profiles`), donc SANS la RLS de `profiles`. C'est le seul point
-- de sortie de la récursion.
--
-- STABLE : le résultat ne change pas dans une même requête, le
-- planificateur peut donc le calculer une fois.
--
-- `set search_path` : obligatoire sur une fonction SECURITY DEFINER
-- sans quoi un schéma malveillant placé en tête du search_path
-- pourrait détourner `profiles` vers sa propre table.

create or replace function public.est_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'ADMIN'
  );
$$;

create or replace function public.mon_atelier_id()
returns smallint
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.atelier_id from public.profiles p where p.id = auth.uid();
$$;

create or replace function public.mon_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.role from public.profiles p where p.id = auth.uid();
$$;

-- Aucun rôle public ne doit pouvoir appeler ces fonctions : elles
-- disent qui est admin. `authenticated` suffit — c'est le rôle de
-- tout utilisateur connecté.
revoke all on function public.est_admin()      from public, anon;
revoke all on function public.mon_atelier_id() from public, anon;
revoke all on function public.mon_role()       from public, anon;
grant execute on function public.est_admin()      to authenticated, service_role;
grant execute on function public.mon_atelier_id() to authenticated, service_role;
grant execute on function public.mon_role()       to authenticated, service_role;

-- ═══════════════════════════════════════════════════════════
-- 2. LES POLITIQUES DE `profiles` — la boucle elle-même
-- ═══════════════════════════════════════════════════════════

-- Chacun lit SA ligne ; un ADMIN lit tout le monde. La condition
-- « suis-je ADMIN ? » passe désormais par est_admin(), qui ne
-- redéclenche pas la politique.
drop policy if exists "profiles self" on profiles;
create policy "profiles self" on profiles for select to authenticated
using (id = auth.uid() or public.est_admin());

drop policy if exists "admin manage profiles" on profiles;
create policy "admin manage profiles" on profiles for all to authenticated
using (public.est_admin())
with check (public.est_admin());

-- ── Et AUCUNE politique d'insertion, volontairement ──
-- `profiles.role` n'a pas de valeur par défaut et son CHECK accepte
-- 'ADMIN'. Une politique d'insertion « chacun crée sa ligne » serait
-- donc une ESCALADE DE PRIVILÈGE : un compte ordinaire s'écrirait
-- `role = 'ADMIN'` et deviendrait administrateur.
--
-- Elle n'est pas nécessaire : rien ne crée de profil côté client. La
-- page Équipe passe par la clé de service (createServiceSupabase),
-- qui ne dépend d'aucune politique. On ne l'ajoute donc pas.
-- Et si une version antérieure de cette migration l'avait posée, on
-- la retire.
drop policy if exists "profil self insert" on profiles;

-- ═══════════════════════════════════════════════════════════
-- 3. TOUTES LES AUTRES POLITIQUES QUI MENTIONNENT `profiles`
-- ═══════════════════════════════════════════════════════════
-- Chaque politique est relue depuis `pg_policies`, supprimée, puis
-- recréée avec la MÊME commande, les MÊMES rôles, et remplacée
-- uniquement sur la condition « est ADMIN ». Une politique inconnue
-- n'est jamais supprimée : elle est signalée.
--
-- ⚠️ La liste est D'ABORD matérialisée dans une table temporaire.
--    Parcourir `pg_policies` en le modifiant à chaque tour fait
--    lire au curseur un catalogue qui change sous lui ; la liste
--    figée garantit qu'on traite exactement ce qu'on a vu.
do $mig$
declare
  r         record;
  nb        integer := 0;
  reste     text[] := '{}';
  roles_txt text;
begin
  drop table if exists _rls_cibles;
  create temp table _rls_cibles on commit drop as
    select tablename, policyname, roles, cmd,
           coalesce(qual, '') as qual,
           coalesce(with_check, '') as with_check
    from pg_policies
    where schemaname = 'public'
      and upper(coalesce(qual, '') || ' ' || coalesce(with_check, '')) like '%PROFILES%';

  for r in select * from _rls_cibles order by tablename, policyname
  loop
    -- Les rôles d'origine, rendus tels quels.
    select string_agg(quote_ident(t.x), ', ') into roles_txt
      from unnest(r.roles) as t(x);
    if roles_txt is null or roles_txt = '' then roles_txt := 'authenticated'; end if;

    if r.policyname in (
      'admin write all', 'admin write orders', 'admin write templates',
      'admin write categories', 'admin manage profiles'
    ) then
      execute format('drop policy %I on public.%I', r.policyname, r.tablename);
      execute format(
        'create policy %I on public.%I for all to %s using (public.est_admin()) with check (public.est_admin())',
        r.policyname, r.tablename, roles_txt
      );
      nb := nb + 1;

    elsif r.policyname = 'profiles self' then
      -- Déjà refaite au bloc 2 ; on ne la recrée pas deux fois.
      continue;

    elsif r.policyname = 'worker update own atelier steps' then
      -- Un ouvrier met à jour les étapes de SON atelier ; un ADMIN,
      -- toutes. `atelier_id` est bien une colonne de work_order_steps.
      execute format('drop policy %I on public.%I', r.policyname, r.tablename);
      execute format(
        'create policy %I on public.%I for update to %s using (public.est_admin() or public.mon_atelier_id() = %I.atelier_id)',
        r.policyname, r.tablename, roles_txt, r.tablename
      );
      nb := nb + 1;

    else
      -- Inconnue : on ne touche à rien, on la nomme.
      reste := reste || format('%s · %s (%s)', r.tablename, r.policyname, r.cmd);
    end if;
  end loop;

  raise notice '0019 : % politique(s) réécrite(s) sans récursion.', nb;
  if array_length(reste, 1) > 0 then
    raise warning
      '0019 : % politique(s) mentionnent encore profiles et n''ont PAS été touchées — à vérifier à la main : %',
      array_length(reste, 1), array_to_string(reste, ' | ');
  end if;
end
$mig$;

-- ═══════════════════════════════════════════════════════════
-- 4. PLUS AUCUNE POLITIQUE NE DOIT INTERROGER `profiles`
-- ═══════════════════════════════════════════════════════════
-- Contrôle final. Si cette requête renvoie des lignes, la récursion
-- peut revenir : il faut traiter la politique nommée.
do $check$
declare n integer;
begin
  select count(*) into n
  from pg_policies
  where schemaname = 'public'
    and upper(coalesce(qual, '') || ' ' || coalesce(with_check, '')) like '%PROFILES%';
  if n = 0 then
    raise notice '0019 : OK — aucune politique n''interroge plus profiles. La récursion est fermée.';
  else
    raise warning '0019 : % politique(s) interrogent encore profiles.', n;
  end if;
end
$check$;
