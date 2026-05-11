alter table public.servicos replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'servicos'
  ) then
    alter publication supabase_realtime add table public.servicos;
  end if;
end $$;