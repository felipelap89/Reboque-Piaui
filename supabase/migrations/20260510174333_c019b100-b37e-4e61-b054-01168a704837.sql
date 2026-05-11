create or replace function public.gerar_numero_servico(p_ano integer default null::integer)
returns text
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_ts timestamptz := now();
  v_ano int := coalesce(p_ano, extract(year from (v_ts at time zone 'America/Fortaleza'))::int);
  v_seq int;
  v_dt text;
begin
  insert into public.servico_sequencias (ano, ultimo)
  values (v_ano, 1)
  on conflict (ano) do update set ultimo = public.servico_sequencias.ultimo + 1
  returning ultimo into v_seq;
  v_dt := to_char(v_ts at time zone 'America/Fortaleza', 'YYYYMMDD-HH24MI');
  return 'OS-' || v_dt || '-' || lpad(v_seq::text, 5, '0');
end $function$;