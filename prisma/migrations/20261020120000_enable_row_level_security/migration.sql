-- Supabase exposes every table in "public" through its REST API (anon key).
-- The app talks to Postgres directly through Prisma as "postgres", which
-- bypasses RLS, so enabling RLS with no policies closes that API without
-- affecting the app. Tables added by later migrations need the same line.
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END
$$;
