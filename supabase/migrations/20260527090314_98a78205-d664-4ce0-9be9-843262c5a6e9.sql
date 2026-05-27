CREATE OR REPLACE FUNCTION public.enforce_guest_max()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.current_setpoint > NEW.guest_max_setpoint THEN
    IF TG_OP = 'UPDATE' AND (OLD.current_setpoint IS NULL OR OLD.current_setpoint <= OLD.guest_max_setpoint) THEN
      NEW.override_started_at := now();
      INSERT INTO public.thermostat_readings (thermostat_id, ts, setpoint, event)
      VALUES (NEW.id, now(), NEW.current_setpoint, 'guest_max_exceeded');
    ELSIF TG_OP = 'INSERT' THEN
      NEW.override_started_at := now();
    END IF;
  ELSE
    NEW.override_started_at := NULL;
  END IF;

  IF NEW.current_setpoint >= NEW.guest_max_setpoint THEN
    IF TG_OP = 'INSERT' OR OLD.current_setpoint IS NULL OR OLD.current_setpoint < OLD.guest_max_setpoint OR NEW.max_hold_started_at IS NULL THEN
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