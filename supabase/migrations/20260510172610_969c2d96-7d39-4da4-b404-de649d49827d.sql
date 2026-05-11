alter table public.servicos add column if not exists veiculo_ano text;

insert into storage.buckets (id, name, public)
values ('os-docs', 'os-docs', true)
on conflict (id) do nothing;

create policy "public read os-docs"
  on storage.objects for select
  using (bucket_id = 'os-docs');