ALTER TABLE public.thermostats
  ADD COLUMN IF NOT EXISTS zone_override boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS override_default_setpoint numeric,
  ADD COLUMN IF NOT EXISTS override_note text,
  ADD COLUMN IF NOT EXISTS override_until timestamptz,
  ADD COLUMN IF NOT EXISTS override_set_at timestamptz,
  ADD COLUMN IF NOT EXISTS override_set_by uuid;