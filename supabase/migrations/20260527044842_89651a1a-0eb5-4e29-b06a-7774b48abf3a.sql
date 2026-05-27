
-- Drop resident column
ALTER TABLE public.apartments DROP COLUMN IF EXISTS resident_name;

-- Zone enum
DO $$ BEGIN
  CREATE TYPE public.thermostat_zone AS ENUM ('room', 'bathroom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add zone + guest_max to thermostats
ALTER TABLE public.thermostats
  ADD COLUMN IF NOT EXISTS zone public.thermostat_zone NOT NULL DEFAULT 'room',
  ADD COLUMN IF NOT EXISTS guest_max_setpoint numeric NOT NULL DEFAULT 23.0;

-- Add override flag column to readings for tracking enforcement events
ALTER TABLE public.thermostat_readings
  ADD COLUMN IF NOT EXISTS event text;

-- Zone defaults table
CREATE TABLE IF NOT EXISTS public.zone_defaults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL,
  zone public.thermostat_zone NOT NULL,
  guest_max_setpoint numeric NOT NULL DEFAULT 23.0,
  default_setpoint numeric NOT NULL DEFAULT 21.0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (building_id, zone)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.zone_defaults TO authenticated;
GRANT ALL ON public.zone_defaults TO service_role;

ALTER TABLE public.zone_defaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers manage zone defaults" ON public.zone_defaults
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'manager'));

CREATE TRIGGER zone_defaults_set_updated_at
  BEFORE UPDATE ON public.zone_defaults
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enforcement trigger: cap setpoint to guest_max
CREATE OR REPLACE FUNCTION public.enforce_guest_max()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  over boolean := false;
BEGIN
  IF NEW.current_setpoint > NEW.guest_max_setpoint THEN
    over := true;
    NEW.current_setpoint := NEW.guest_max_setpoint;
  END IF;

  IF over THEN
    INSERT INTO public.thermostat_readings (thermostat_id, ts, setpoint, room_temp, floor_temp, power_w, energy_kwh, event)
    VALUES (NEW.id, now(), NEW.guest_max_setpoint, NULL, NULL, NULL, NULL, 'guest_max_enforced');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS thermostats_enforce_guest_max ON public.thermostats;
CREATE TRIGGER thermostats_enforce_guest_max
  BEFORE INSERT OR UPDATE OF current_setpoint, guest_max_setpoint ON public.thermostats
  FOR EACH ROW EXECUTE FUNCTION public.enforce_guest_max();
