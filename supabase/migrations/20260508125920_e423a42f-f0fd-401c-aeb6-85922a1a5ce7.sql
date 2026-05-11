ALTER TABLE public.servicos ADD COLUMN IF NOT EXISTS via text NOT NULL DEFAULT 'manual';
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS via text NOT NULL DEFAULT 'manual';