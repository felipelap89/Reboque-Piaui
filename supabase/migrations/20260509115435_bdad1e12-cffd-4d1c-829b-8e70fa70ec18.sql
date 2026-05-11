-- Comissão fixa (R$) por chamado e por motorista (substitui percentual)
ALTER TABLE public.servicos
  ADD COLUMN IF NOT EXISTS comissao_valor numeric NOT NULL DEFAULT 0;

ALTER TABLE public.motoristas
  ADD COLUMN IF NOT EXISTS comissao_valor numeric NOT NULL DEFAULT 0;

-- Vincular despesa a motorista (para pagamentos de comissão)
ALTER TABLE public.despesas
  ADD COLUMN IF NOT EXISTS motorista_id uuid REFERENCES public.motoristas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_despesas_motorista ON public.despesas(motorista_id);
CREATE INDEX IF NOT EXISTS idx_servicos_motorista ON public.servicos(motorista_id);