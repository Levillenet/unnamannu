
-- Add override grace period (minutes) to zone defaults
ALTER TABLE public.zone_defaults
  ADD COLUMN IF NOT EXISTS override_grace_minutes integer NOT NULL DEFAULT 2;

-- Track when an over-limit override started on each thermostat
ALTER TABLE public.thermostats
  ADD COLUMN IF NOT EXISTS override_started_at timestamptz;

-- Replace enforce_guest_max: instead of clamping immediately, allow the override
-- but mark when it started. A scheduled job will reset it after the grace period.
CREATE OR REPLACE FUNCTION public.enforce_guest_max()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.current_setpoint > NEW.guest_max_setpoint THEN
    -- Only set the timestamp on the first over-limit change (so the grace
    -- window starts when the guest first pushes past the max).
    IF OLD.current_setpoint IS NULL OR OLD.current_setpoint <= OLD.guest_max_setpoint THEN
      NEW.override_started_at := now();
      INSERT INTO public.thermostat_readings (thermostat_id, ts, setpoint, event)
      VALUES (NEW.id, now(), NEW.current_setpoint, 'guest_max_exceeded');
    END IF;
  ELSE
    -- Back within bounds — clear the override marker.
    NEW.override_started_at := NULL;
  END IF;
  RETURN NEW;
END;
$function$;

-- Ensure the trigger exists (was implicit before).
DROP TRIGGER IF EXISTS trg_enforce_guest_max ON public.thermostats;
CREATE TRIGGER trg_enforce_guest_max
  BEFORE INSERT OR UPDATE OF current_setpoint, guest_max_setpoint ON public.thermostats
  FOR EACH ROW EXECUTE FUNCTION public.enforce_guest_max();

-- Scheduled enforcement: reset thermostats whose grace period has elapsed.
CREATE OR REPLACE FUNCTION public.enforce_pending_overrides()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  reset_count integer := 0;
  r record;
  grace_minutes integer;
BEGIN
  FOR r IN
    SELECT t.id, t.zone, t.guest_max_setpoint, t.override_started_at
    FROM public.thermostats t
    WHERE t.override_started_at IS NOT NULL
      AND t.current_setpoint > t.guest_max_setpoint
  LOOP
    SELECT zd.override_grace_minutes
      INTO grace_minutes
      FROM public.zone_defaults zd
     WHERE zd.zone = r.zone
     LIMIT 1;

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
  RETURN reset_count;
END;
$function$;

-- Schedule the enforcement to run every minute via pg_cron.
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'enforce-thermostat-overrides') THEN
    PERFORM cron.unschedule('enforce-thermostat-overrides');
  END IF;
  PERFORM cron.schedule(
    'enforce-thermostat-overrides',
    '* * * * *',
    $cron$ SELECT public.enforce_pending_overrides(); $cron$
  );
END $$;
