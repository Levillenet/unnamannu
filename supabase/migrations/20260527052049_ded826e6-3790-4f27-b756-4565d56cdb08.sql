CREATE OR REPLACE FUNCTION public.delete_zone_default(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  z text;
  used int;
BEGIN
  SELECT zone INTO z FROM public.zone_defaults WHERE id = _id;
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