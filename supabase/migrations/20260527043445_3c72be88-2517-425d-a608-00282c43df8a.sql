
-- Roles enum + user_roles table (separate from profiles for security)
CREATE TYPE public.app_role AS ENUM ('manager', 'resident');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Auto-assign manager role on signup (MVP: every new signup = isännöitsijä)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'manager')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Reusable updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Buildings
CREATE TABLE public.buildings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.buildings TO authenticated;
GRANT ALL ON public.buildings TO service_role;
ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers manage buildings" ON public.buildings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'manager'));
CREATE TRIGGER buildings_set_updated_at BEFORE UPDATE ON public.buildings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Apartments
CREATE TABLE public.apartments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID REFERENCES public.buildings(id) ON DELETE CASCADE NOT NULL,
  number TEXT NOT NULL,
  floor INTEGER,
  resident_name TEXT,
  size_m2 NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (building_id, number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.apartments TO authenticated;
GRANT ALL ON public.apartments TO service_role;
ALTER TABLE public.apartments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers manage apartments" ON public.apartments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'manager'));
CREATE TRIGGER apartments_set_updated_at BEFORE UPDATE ON public.apartments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Schedules
CREATE TABLE public.schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  -- weekly_program: array of 7 days, each with array of {hour, setpoint}
  weekly_program JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedules TO authenticated;
GRANT ALL ON public.schedules TO service_role;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers manage schedules" ON public.schedules
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'manager'));
CREATE TRIGGER schedules_set_updated_at BEFORE UPDATE ON public.schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Thermostats
CREATE TYPE public.thermostat_status AS ENUM ('online', 'offline', 'alarm');

CREATE TABLE public.thermostats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  apartment_id UUID REFERENCES public.apartments(id) ON DELETE CASCADE NOT NULL,
  ebeco_device_id TEXT,
  name TEXT NOT NULL,
  room TEXT,
  status thermostat_status NOT NULL DEFAULT 'online',
  enabled BOOLEAN NOT NULL DEFAULT true,
  locked BOOLEAN NOT NULL DEFAULT false,
  current_setpoint NUMERIC NOT NULL DEFAULT 21.0,
  min_setpoint NUMERIC NOT NULL DEFAULT 5.0,
  max_setpoint NUMERIC NOT NULL DEFAULT 35.0,
  current_schedule_id UUID REFERENCES public.schedules(id) ON DELETE SET NULL,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.thermostats TO authenticated;
GRANT ALL ON public.thermostats TO service_role;
ALTER TABLE public.thermostats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers manage thermostats" ON public.thermostats
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'manager'));
CREATE TRIGGER thermostats_set_updated_at BEFORE UPDATE ON public.thermostats
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_thermostats_apartment ON public.thermostats(apartment_id);

-- Thermostat readings (time series)
CREATE TABLE public.thermostat_readings (
  id BIGSERIAL PRIMARY KEY,
  thermostat_id UUID REFERENCES public.thermostats(id) ON DELETE CASCADE NOT NULL,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  room_temp NUMERIC,
  floor_temp NUMERIC,
  setpoint NUMERIC,
  power_w NUMERIC,
  energy_kwh NUMERIC
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.thermostat_readings TO authenticated;
GRANT ALL ON public.thermostat_readings TO service_role;
ALTER TABLE public.thermostat_readings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers read readings" ON public.thermostat_readings
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'manager'));
CREATE POLICY "Managers insert readings" ON public.thermostat_readings
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'manager'));
CREATE INDEX idx_readings_thermostat_ts ON public.thermostat_readings(thermostat_id, ts DESC);

-- Schedule assignments (which schedule applies to which thermostats / apartments)
CREATE TABLE public.schedule_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID REFERENCES public.schedules(id) ON DELETE CASCADE NOT NULL,
  thermostat_id UUID REFERENCES public.thermostats(id) ON DELETE CASCADE,
  apartment_id UUID REFERENCES public.apartments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((thermostat_id IS NOT NULL) OR (apartment_id IS NOT NULL))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_assignments TO authenticated;
GRANT ALL ON public.schedule_assignments TO service_role;
ALTER TABLE public.schedule_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers manage assignments" ON public.schedule_assignments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'manager'));
