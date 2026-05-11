
ALTER TABLE public.contas
  ADD COLUMN IF NOT EXISTS banco text,
  ADD COLUMN IF NOT EXISTS numero_conta text,
  ADD COLUMN IF NOT EXISTS telefone_responsavel text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pode_abrir_chamado boolean NOT NULL DEFAULT false;
