
ALTER TABLE public.thermostats
  ADD COLUMN IF NOT EXISTS ebeco_settings jsonb,
  ADD COLUMN IF NOT EXISTS sensor_application text,
  ADD COLUMN IF NOT EXISTS sensor_type text,
  ADD COLUMN IF NOT EXISTS display_when_idle text,
  ADD COLUMN IF NOT EXISTS light_idle integer,
  ADD COLUMN IF NOT EXISTS light_active integer,
  ADD COLUMN IF NOT EXISTS child_lock boolean,
  ADD COLUMN IF NOT EXISTS selected_program text,
  ADD COLUMN IF NOT EXISTS installed_effect_w integer,
  ADD COLUMN IF NOT EXISTS adaptive_start boolean,
  ADD COLUMN IF NOT EXISTS open_window_detection boolean,
  ADD COLUMN IF NOT EXISTS temperature_calibration_room numeric,
  ADD COLUMN IF NOT EXISTS temperature_calibration_floor numeric,
  ADD COLUMN IF NOT EXISTS min_floor_temp numeric,
  ADD COLUMN IF NOT EXISTS max_floor_temp numeric,
  ADD COLUMN IF NOT EXISTS floor_temp_cut_off numeric,
  ADD COLUMN IF NOT EXISTS language text;
