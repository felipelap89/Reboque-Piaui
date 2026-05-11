
ALTER TABLE public.veiculos
  ADD COLUMN IF NOT EXISTS marca text,
  ADD COLUMN IF NOT EXISTS cor text;

CREATE OR REPLACE FUNCTION public.tg_somar_km_veiculo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'Finalizado'
     AND NEW.veiculo_id IS NOT NULL
     AND COALESCE(NEW.km, 0) > 0
     AND (TG_OP = 'INSERT' OR COALESCE(OLD.status, '') <> 'Finalizado')
  THEN
    UPDATE public.veiculos
       SET km = COALESCE(km, 0) + COALESCE(NEW.km, 0),
           updated_at = now()
     WHERE id = NEW.veiculo_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_somar_km_veiculo ON public.servicos;
CREATE TRIGGER trg_somar_km_veiculo
AFTER INSERT OR UPDATE ON public.servicos
FOR EACH ROW EXECUTE FUNCTION public.tg_somar_km_veiculo();

DROP TRIGGER IF EXISTS trg_lancar_comissao ON public.servicos;
CREATE TRIGGER trg_lancar_comissao
AFTER INSERT OR UPDATE ON public.servicos
FOR EACH ROW EXECUTE FUNCTION public.tg_lancar_comissao();
