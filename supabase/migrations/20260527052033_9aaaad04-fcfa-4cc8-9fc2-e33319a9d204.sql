-- Convert zone enum to text (dynamic zones), drop default_setpoint, add label
ALTER TABLE public.thermostats ALTER COLUMN zone DROP DEFAULT;
ALTER TABLE public.thermostats ALTER COLUMN zone TYPE text USING zone::text;
ALTER TABLE public.thermostats ALTER COLUMN zone SET DEFAULT 'room';

ALTER TABLE public.zone_defaults ALTER COLUMN zone TYPE text USING zone::text;
ALTER TABLE public.zone_defaults DROP COLUMN IF EXISTS default_setpoint;
ALTER TABLE public.zone_defaults ADD COLUMN IF NOT EXISTS label text;

UPDATE public.zone_defaults SET label = CASE zone
  WHEN 'room' THEN 'Huone'
  WHEN 'bathroom' THEN 'Kylpyhuone'
  ELSE initcap(zone)
END WHERE label IS NULL;

ALTER TABLE public.zone_defaults ALTER COLUMN label SET NOT NULL;

-- Validation: slug format
ALTER TABLE public.zone_defaults DROP CONSTRAINT IF EXISTS zone_defaults_zone_format;
ALTER TABLE public.zone_defaults ADD CONSTRAINT zone_defaults_zone_format CHECK (zone ~ '^[a-z0-9_-]+$');

-- Ensure uniqueness (building_id, zone)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'zone_defaults_building_zone_uniq') THEN
    ALTER TABLE public.zone_defaults ADD CONSTRAINT zone_defaults_building_zone_uniq UNIQUE (building_id, zone);
  END IF;
END $$;

-- Drop the enum type now that no columns use it
DROP TYPE IF EXISTS public.thermostat_zone;

-- Delete zone defaults (and prevent if thermostats reference the zone)
CREATE OR REPLACE FUNCTION public.delete_zone_default(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  z text;
  bid uuid;
  used int;
BEGIN
  SELECT zone, building_id INTO z, bid FROM public.zone_defaults WHERE id = _id;
  IF z IS NULL THEN
    RAISE EXCEPTION 'Vyöhykettä ei löydy';
  END IF;
  SELECT count(*) INTO used FROM public.thermostats WHERE zone = z;
  IF used > 0 THEN
    RAISE EXCEPTION 'Vyöhykettä % käyttää % termostaattia — siirrä ne ensin toiseen vyöhykkeeseen', z, used;
  END IF;
  DELETE FROM public.zone_defaults WHERE id = _id;
END;
$$;