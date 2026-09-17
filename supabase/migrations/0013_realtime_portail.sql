-- ═══════════════════════════════════════════
-- MIGRATION 0013 : TEMPS RÉEL DES PORTAILS (tablettes)
-- Les files d'ateliers écoutent postgres_changes via Realtime.
-- Les tables doivent appartenir à la publication `supabase_realtime`.
-- Idempotent : n'ajoute que les tables manquantes.
-- À exécuter APRÈS 0012 dans Supabase SQL Editor (ou psql).
-- ═══════════════════════════════════════════

DO $$
DECLARE t TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY[
      'work_order_steps',
      'site_transfers',
      'material_logs',
      'stock_items',
      'destinations',
      'semi_finished_stock'
    ]
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = t
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    END LOOP;
  END IF;
END $$;
