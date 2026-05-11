-- Status de pagamento e vínculo da despesa com o chamado
ALTER TABLE public.despesas
  ADD COLUMN IF NOT EXISTS pago boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS data_pagamento timestamptz NULL,
  ADD COLUMN IF NOT EXISTS servico_id uuid NULL REFERENCES public.servicos(id) ON DELETE CASCADE;

-- Evita duplicar a comissão para o mesmo chamado
CREATE UNIQUE INDEX IF NOT EXISTS uq_despesas_servico_comissao
  ON public.despesas(servico_id) WHERE servico_id IS NOT NULL;

-- Trigger: ao finalizar um chamado com motorista e comissão > 0, lançar despesa pendente
CREATE OR REPLACE FUNCTION public.tg_lancar_comissao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m_nome text;
BEGIN
  IF NEW.status = 'Finalizado'
     AND NEW.motorista_id IS NOT NULL
     AND COALESCE(NEW.comissao_valor, 0) > 0
     AND (TG_OP = 'INSERT' OR COALESCE(OLD.status, '') <> 'Finalizado')
  THEN
    SELECT nome INTO m_nome FROM public.motoristas WHERE id = NEW.motorista_id;

    INSERT INTO public.despesas (tipo, valor, data, responsavel, obs, motorista_id, servico_id, pago)
    VALUES (
      'Comissão',
      NEW.comissao_valor,
      now(),
      COALESCE(m_nome, ''),
      'Comissão do chamado de ' || COALESCE(NEW.cliente, ''),
      NEW.motorista_id,
      NEW.id,
      false
    )
    ON CONFLICT (servico_id) WHERE servico_id IS NOT NULL DO NOTHING;
  END IF;

  -- Se cancelado, remove despesa pendente vinculada
  IF TG_OP = 'UPDATE'
     AND NEW.status = 'Cancelado'
     AND COALESCE(OLD.status, '') <> 'Cancelado'
  THEN
    DELETE FROM public.despesas
    WHERE servico_id = NEW.id AND pago = false;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lancar_comissao ON public.servicos;
CREATE TRIGGER trg_lancar_comissao
AFTER INSERT OR UPDATE OF status, comissao_valor, motorista_id ON public.servicos
FOR EACH ROW
EXECUTE FUNCTION public.tg_lancar_comissao();

-- Backfill: lançar comissões pendentes para chamados já finalizados que ainda não têm despesa
INSERT INTO public.despesas (tipo, valor, data, responsavel, obs, motorista_id, servico_id, pago)
SELECT 'Comissão', s.comissao_valor, now(),
       COALESCE(m.nome, ''),
       'Comissão do chamado de ' || COALESCE(s.cliente, ''),
       s.motorista_id, s.id, false
FROM public.servicos s
LEFT JOIN public.motoristas m ON m.id = s.motorista_id
WHERE s.status = 'Finalizado'
  AND s.motorista_id IS NOT NULL
  AND COALESCE(s.comissao_valor, 0) > 0
  AND NOT EXISTS (SELECT 1 FROM public.despesas d WHERE d.servico_id = s.id);