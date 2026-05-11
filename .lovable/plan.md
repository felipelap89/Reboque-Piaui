## Sistema de número de chamados (código sequencial por OS)

Hoje cada chamado tem só um UUID interno (ex: `a1b2c3d4-…`), o que é ruim para falar com cliente, motorista ou achar rápido na lista. A ideia é dar um **código curto, sequencial e único** para cada chamado — tipo `OS-2026-00123` — visível em todo lugar onde o chamado aparece.

### Como o usuário vai ver

- Cada novo chamado ganha automaticamente um código no formato **`OS-AAAA-NNNNN`** (ex: `OS-2026-00042`).
  - `AAAA` = ano de criação.
  - `NNNNN` = sequência que reinicia a cada ano (zerada com 5 dígitos).
- O código aparece:
  - No **card/linha do chamado** em `/servicos` (coluna nova "Nº", em destaque).
  - No **diálogo de detalhes/edição** do chamado.
  - Nas **notificações do sino** (ex: "🚨 OS-2026-00042 — João da Silva").
  - Nas **mensagens de WhatsApp** enviadas ao motorista, gestores e na finalização (comissão).
  - Em **relatórios e financeiro**, sempre que a tabela mostrar chamados.
- Um **botão "copiar"** ao lado do código para colar fácil em conversa.
- A **busca** em `/servicos` passa a aceitar o código (ex: digitar `42` ou `OS-2026-00042` encontra o chamado).

### Como funciona por baixo

1. **Coluna nova `numero` em `public.servicos`** (texto, único). Guarda o código já formatado.
2. **Sequence + função geradora no Postgres**:
   - Sequência por ano: usar uma tabela auxiliar `servico_sequencias (ano int PK, ultimo int)` ou `nextval` por ano via função.
   - Função `gerar_numero_servico()` que pega o ano corrente, incrementa o contador daquele ano e retorna `OS-AAAA-NNNNN`.
3. **Trigger `BEFORE INSERT` em `servicos`** que preenche `numero` se vier vazio. Garante atomicidade — sem duplicidade mesmo com 2 chamados criados ao mesmo tempo.
4. **Backfill** dos chamados existentes: ordenar por `created_at` e atribuir códigos retroativos no ano de cada um, para nada ficar sem número.
5. **Frontend**:
   - `Service` em `src/lib/data.ts` ganha `numero: string`.
   - Mapper `mapService` lê `r.numero`.
   - `src/routes/servicos.tsx`: nova coluna "Nº" no topo da tabela/card; busca passa a filtrar por `numero` também.
   - `src/components/NotificationBell.tsx` e `src/hooks/use-notifications.tsx`: incluir `numero` no select e exibir junto do cliente.
   - Mensagens de WhatsApp em `src/lib/notify-driver.functions.ts`, `notify-manager.functions.ts` e `notify-commission.functions.ts`: prefixar com o número do chamado.

### Mudanças no banco (1 migration)

```sql
-- 1. Tabela auxiliar de sequência por ano
create table public.servico_sequencias (
  ano int primary key,
  ultimo int not null default 0
);

-- 2. Coluna numero
alter table public.servicos add column numero text unique;

-- 3. Função geradora (atômica via UPSERT + RETURNING)
create or replace function public.gerar_numero_servico()
returns text language plpgsql security definer set search_path=public as $$
declare
  v_ano int := extract(year from now())::int;
  v_seq int;
begin
  insert into public.servico_sequencias (ano, ultimo) values (v_ano, 1)
  on conflict (ano) do update set ultimo = servico_sequencias.ultimo + 1
  returning ultimo into v_seq;
  return 'OS-' || v_ano || '-' || lpad(v_seq::text, 5, '0');
end $$;

-- 4. Trigger BEFORE INSERT
create or replace function public.tg_set_numero_servico()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.numero is null or new.numero = '' then
    new.numero := public.gerar_numero_servico();
  end if;
  return new;
end $$;

create trigger trg_set_numero_servico
before insert on public.servicos
for each row execute function public.tg_set_numero_servico();

-- 5. Backfill (numera os existentes por ordem de criação, agrupado por ano)
-- (script no migration que percorre servicos sem numero)
```

### Arquivos tocados

- **Migration nova** — coluna, sequência, função, trigger e backfill.
- **`src/lib/data.ts`** — adiciona `numero` em `Service` e no mapper.
- **`src/routes/servicos.tsx`** — coluna "Nº", busca por número, exibição no diálogo.
- **`src/hooks/use-notifications.tsx`** — incluir `numero` no select e na exibição.
- **`src/components/NotificationBell.tsx`** — mostrar `numero` antes do cliente.
- **`src/lib/notify-driver.functions.ts`**, **`notify-manager.functions.ts`**, **`notify-commission.functions.ts`** — prefixar mensagens com o número.

### Fora do escopo (faço depois se quiser)

- Permitir editar o número manualmente (hoje seria automático e imutável).
- QR Code do chamado para escanear.
- Filtro por intervalo de números nos relatórios.
- Reset/renumeração manual da sequência.
