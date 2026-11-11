CREATE OR REPLACE FUNCTION public.log_thermostat_status_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.thermostat_status_events (thermostat_id, status, error_message)
    VALUES (NEW.id, NEW.status::text, CASE WHEN NEW.status <> 'online' THEN NEW.ebeco_settings->>'errorMessage' END);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER thermostats_status_change AFTER UPDATE OF status ON public.thermostats FOR EACH ROW EXECUTE FUNCTION public.log_thermostat_status_change();