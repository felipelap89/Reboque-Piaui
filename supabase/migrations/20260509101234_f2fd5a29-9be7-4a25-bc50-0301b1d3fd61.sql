-- Tabela de contas de pagamento
create table public.contas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  pix_key text,
  qr_path text,
  ativa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.contas enable row level security;

create policy "staff read contas" on public.contas
  for select using (public.is_staff(auth.uid()));

create policy "admin write contas" on public.contas
  for all using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

create trigger contas_updated_at before update on public.contas
  for each row execute function public.tg_set_updated_at();

-- Novos campos em servicos
alter table public.servicos
  add column conta_id uuid references public.contas(id) on delete set null,
  add column comissao_pct numeric not null default 0,
  add column placa text,
  add column veiculo_modelo text;

-- Storage bucket público para QR codes
insert into storage.buckets (id, name, public) values ('contas-qr', 'contas-qr', true)
  on conflict (id) do nothing;

create policy "QR codes publicly accessible"
  on storage.objects for select
  using (bucket_id = 'contas-qr');

create policy "Admins upload QR codes"
  on storage.objects for insert
  with check (bucket_id = 'contas-qr' and public.has_role(auth.uid(), 'admin'::public.app_role));

create policy "Admins update QR codes"
  on storage.objects for update
  using (bucket_id = 'contas-qr' and public.has_role(auth.uid(), 'admin'::public.app_role));

create policy "Admins delete QR codes"
  on storage.objects for delete
  using (bucket_id = 'contas-qr' and public.has_role(auth.uid(), 'admin'::public.app_role));