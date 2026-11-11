CREATE TABLE public.thermostat_sensor_events (
  id bigserial PRIMARY KEY,
  thermostat_id uuid NOT NULL REFERENCES public.thermostats(id) ON DELETE CASCADE,
  ts timestamptz NOT NULL DEFAULT now(),
  old_app text,
  new_app text
);
GRANT SELECT ON public.thermostat_sensor_events TO authenticated;
GRANT ALL ON public.thermostat_sensor_events TO service_role;
GRANT USAGE ON SEQUENCE public.thermostat_sensor_events_id_seq TO service_role;
ALTER TABLE public.thermostat_sensor_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Roles read sensor events" ON public.thermostat_sensor_events FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE INDEX thermostat_sensor_events_tid_ts ON public.thermostat_sensor_events(thermostat_id, ts DESC);

CREATE OR REPLACE FUNCTION public.log_thermostat_sensor_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o text; n text;
BEGIN
  o := OLD.ebeco_settings->>'sensorApplication';
  n := NEW.ebeco_settings->>'sensorApplication';
  IF n IS NOT NULL AND o IS DISTINCT FROM n THEN
    INSERT INTO public.thermostat_sensor_events(thermostat_id, old_app, new_app) VALUES (NEW.id, o, n);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER thermostats_sensor_change AFTER UPDATE OF ebeco_settings ON public.thermostats
FOR EACH ROW EXECUTE FUNCTION public.log_thermostat_sensor_change();