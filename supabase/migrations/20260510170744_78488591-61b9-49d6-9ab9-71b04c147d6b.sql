ALTER TABLE public.servicos REPLICA IDENTITY FULL;
DO $$ BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.servicos;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;