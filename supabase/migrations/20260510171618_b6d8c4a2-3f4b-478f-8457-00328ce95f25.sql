-- 1. Tabela auxiliar
create table if not exists public.servico_sequencias (
  ano int primary key,
  ultimo int not null default 0
);

alter table public.servico_sequencias enable row level security;

create policy "staff read servico_sequencias"
  on public.servico_sequencias for select
  using (public.is_staff(auth.uid()));

-- 2. Coluna numero
alter table public.servicos add column if not exists numero text;
create unique index if not exists servicos_numero_uk on public.servicos(numero);

-- 3. Função geradora
create or replace function public.gerar_numero_servico(p_ano int default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ano int := coalesce(p_ano, extract(year from now())::int);
  v_seq int;
begin
  insert into public.servico_sequencias (ano, ultimo)
  values (v_ano, 1)
  on conflict (ano) do update set ultimo = public.servico_sequencias.ultimo + 1
  returning ultimo into v_seq;
  return 'OS-' || v_ano || '-' || lpad(v_seq::text, 5, '0');
end $$;

-- 4. Trigger BEFORE INSERT
create or replace function public.tg_set_numero_servico()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.numero is null or new.numero = '' then
    new.numero := public.gerar_numero_servico();
  end if;
  return new;
end $$;

drop trigger if exists trg_set_numero_servico on public.servicos;
create trigger trg_set_numero_servico
before insert on public.servicos
for each row execute function public.tg_set_numero_servico();

-- 5. Backfill — numera chamados existentes em ordem de criação por ano
do $$
declare
  r record;
  v_ano int;
  v_num text;
begin
  for r in
    select id, extract(year from created_at)::int as ano
    from public.servicos
    where numero is null
    order by created_at asc, id asc
  loop
    v_num := public.gerar_numero_servico(r.ano);
    update public.servicos set numero = v_num where id = r.id;
  end loop;
end $$;

alter table public.servicos alter column numero set not null;