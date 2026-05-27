ALTER TABLE public.zone_defaults
  ADD COLUMN default_setpoint numeric NOT NULL DEFAULT 21.0,
  ADD COLUMN max_hold_minutes integer NOT NULL DEFAULT 360;

ALTER TABLE public.thermostats
  ADD COLUMN max_hold_started_at timestamptz;

CREATE OR REPLACE FUNCTION public.enforce_guest_max()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Track over-max overrides for grace-period enforcement
  IF NEW.current_setpoint > NEW.guest_max_setpoint THEN
    IF OLD.current_setpoint IS NULL OR OLD.current_setpoint <= OLD.guest_max_setpoint THEN
      NEW.override_started_at := now();
      INSERT INTO public.thermostat_readings (thermostat_id, ts, setpoint, event)
      VALUES (NEW.id, now(), NEW.current_setpoint, 'guest_max_exceeded');
    END IF;
  ELSE
    NEW.override_started_at := NULL;
  END IF;

  -- Track "at or above max" hold timer for return-to-default
  IF NEW.current_setpoint >= NEW.guest_max_setpoint THEN
    IF OLD.current_setpoint IS NULL OR OLD.current_setpoint < OLD.guest_max_setpoint OR NEW.max_hold_started_at IS NULL THEN
      IF NEW.max_hold_started_at IS NULL THEN
        NEW.max_hold_started_at := now();
      END IF;
    END IF;
  ELSE
    NEW.max_hold_started_at := NULL;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_pending_overrides()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  reset_count integer := 0;
  r record;
  grace_minutes integer;
  hold_minutes integer;
  zone_default numeric;
BEGIN
  -- 1) Over-max overrides: snap back to max after grace period
  FOR r IN
    SELECT t.id, t.zone, t.guest_max_setpoint, t.override_started_at
    FROM public.thermostats t
    WHERE t.override_started_at IS NOT NULL
      AND t.current_setpoint > t.guest_max_setpoint
  LOOP
    SELECT zd.override_grace_minutes INTO grace_minutes
      FROM public.zone_defaults zd WHERE zd.zone = r.zone LIMIT 1;
    grace_minutes := COALESCE(grace_minutes, 2);

    IF r.override_started_at <= now() - make_interval(mins => grace_minutes) THEN
      UPDATE public.thermostats
         SET current_setpoint = guest_max_setpoint,
             override_started_at = NULL
       WHERE id = r.id;

      INSERT INTO public.thermostat_readings (thermostat_id, ts, setpoint, event)
      VALUES (r.id, now(), r.guest_max_setpoint, 'guest_max_enforced');

      reset_count := reset_count + 1;
    END IF;
  END LOOP;

  -- 2) Max-hold: after holding at max for N minutes, return to default
  FOR r IN
    SELECT t.id, t.zone, t.guest_max_setpoint, t.max_hold_started_at
    FROM public.thermostats t
    WHERE t.max_hold_started_at IS NOT NULL
      AND t.current_setpoint >= t.guest_max_setpoint
  LOOP
    SELECT zd.max_hold_minutes, zd.default_setpoint
      INTO hold_minutes, zone_default
      FROM public.zone_defaults zd WHERE zd.zone = r.zone LIMIT 1;

    -- 0 = disabled
    IF hold_minutes IS NULL OR hold_minutes <= 0 THEN
      CONTINUE;
    END IF;
    zone_default := COALESCE(zone_default, 21.0);

    IF r.max_hold_started_at <= now() - make_interval(mins => hold_minutes) THEN
      UPDATE public.thermostats
         SET current_setpoint = zone_default,
             max_hold_started_at = NULL,
             override_started_at = NULL
       WHERE id = r.id;

      INSERT INTO public.thermostat_readings (thermostat_id, ts, setpoint, event)
      VALUES (r.id, now(), zone_default, 'max_hold_expired');

      reset_count := reset_count + 1;
    END IF;
  END LOOP;

  RETURN reset_count;
END;
$function$;