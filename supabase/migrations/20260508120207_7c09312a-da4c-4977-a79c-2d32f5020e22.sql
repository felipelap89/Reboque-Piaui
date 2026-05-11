
-- Roles enum
create type public.app_role as enum ('admin','operador','financeiro');

-- Profiles
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  nome text not null default '',
  telefone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- User roles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

-- has_role
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- updated_at trigger function
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

-- Auto profile + first user becomes admin
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare cnt int;
begin
  insert into public.profiles (user_id, nome)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', split_part(new.email,'@',1)));

  select count(*) into cnt from public.user_roles;
  if cnt = 0 then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  else
    insert into public.user_roles (user_id, role)
    values (new.id, coalesce((new.raw_user_meta_data->>'role')::public.app_role, 'operador'));
  end if;
  return new;
end; $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create trigger profiles_updated_at before update on public.profiles
for each row execute function public.tg_set_updated_at();

-- Profiles policies
create policy "users read own profile" on public.profiles for select using (auth.uid() = user_id);
create policy "admin reads all profiles" on public.profiles for select using (public.has_role(auth.uid(),'admin'));
create policy "users update own profile" on public.profiles for update using (auth.uid() = user_id);
create policy "admin updates any profile" on public.profiles for update using (public.has_role(auth.uid(),'admin'));

-- user_roles policies
create policy "user reads own roles" on public.user_roles for select using (auth.uid() = user_id);
create policy "admin reads all roles" on public.user_roles for select using (public.has_role(auth.uid(),'admin'));
create policy "admin manages roles" on public.user_roles for all using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- ============== Business tables ==============
create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  telefone text,
  documento text,
  endereco text,
  obs text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.clientes enable row level security;
create trigger clientes_updated_at before update on public.clientes for each row execute function public.tg_set_updated_at();

create table public.motoristas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  telefone text,
  cnh text,
  categoria text,
  ativo boolean not null default true,
  comissao_pct numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.motoristas enable row level security;
create trigger motoristas_updated_at before update on public.motoristas for each row execute function public.tg_set_updated_at();

create table public.veiculos (
  id uuid primary key default gen_random_uuid(),
  modelo text not null,
  placa text not null,
  km integer not null default 0,
  consumo_medio numeric not null default 0,
  proxima_manutencao_km integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.veiculos enable row level security;
create trigger veiculos_updated_at before update on public.veiculos for each row execute function public.tg_set_updated_at();

create table public.servicos (
  id uuid primary key default gen_random_uuid(),
  cliente text not null,
  telefone text,
  origem text,
  destino text,
  tipo text not null,
  valor numeric not null default 0,
  pagamento text,
  km numeric not null default 0,
  motorista_id uuid references public.motoristas(id) on delete set null,
  veiculo_id uuid references public.veiculos(id) on delete set null,
  status text not null default 'Pendente',
  data timestamptz not null default now(),
  obs text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.servicos enable row level security;
create trigger servicos_updated_at before update on public.servicos for each row execute function public.tg_set_updated_at();

create table public.despesas (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  valor numeric not null default 0,
  data timestamptz not null default now(),
  responsavel text,
  obs text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.despesas enable row level security;
create trigger despesas_updated_at before update on public.despesas for each row execute function public.tg_set_updated_at();

-- Helper: any authenticated user with a role
create or replace function public.is_staff(_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _uid)
$$;

-- Read for all staff
create policy "staff read clientes" on public.clientes for select using (public.is_staff(auth.uid()));
create policy "staff read motoristas" on public.motoristas for select using (public.is_staff(auth.uid()));
create policy "staff read veiculos" on public.veiculos for select using (public.is_staff(auth.uid()));
create policy "staff read servicos" on public.servicos for select using (public.is_staff(auth.uid()));
create policy "staff read despesas" on public.despesas for select using (public.is_staff(auth.uid()));

-- Admin full write on master data
create policy "admin write clientes" on public.clientes for all using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "admin write motoristas" on public.motoristas for all using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "admin write veiculos" on public.veiculos for all using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- Servicos: admin/operador/financeiro can write
create policy "ops write servicos" on public.servicos for insert
  with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'operador') or public.has_role(auth.uid(),'financeiro'));
create policy "ops update servicos" on public.servicos for update
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'operador') or public.has_role(auth.uid(),'financeiro'));
create policy "admin delete servicos" on public.servicos for delete using (public.has_role(auth.uid(),'admin'));

-- Despesas: admin/financeiro write
create policy "fin write despesas" on public.despesas for insert
  with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'financeiro'));
create policy "fin update despesas" on public.despesas for update
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'financeiro'));
create policy "admin delete despesas" on public.despesas for delete using (public.has_role(auth.uid(),'admin'));

create index on public.servicos (data desc);
create index on public.despesas (data desc);
create index on public.user_roles (user_id);
