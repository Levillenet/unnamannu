-- ============================================
-- 1. Convert all existing 'manager' roles to 'admin'
-- ============================================
UPDATE public.user_roles SET role = 'admin' WHERE role = 'manager';

-- ============================================
-- 2. handle_new_user: stop auto-granting roles. Admin invites users explicitly.
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  RETURN NEW;
END;
$function$;

-- ============================================
-- 3. Profiles table
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read profiles" ON public.profiles;
CREATE POLICY "Authenticated read profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Backfill profiles for existing users
INSERT INTO public.profiles (id, email)
SELECT u.id, u.email FROM auth.users u
ON CONFLICT (id) DO NOTHING;

-- Ensure trigger exists on auth.users (create if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;

-- ============================================
-- 4. is_admin() helper
-- ============================================
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'user')
  )
$$;

-- ============================================
-- 5. Audit log
-- ============================================
CREATE TABLE IF NOT EXISTS public.audit_log (
  id bigserial PRIMARY KEY,
  ts timestamptz NOT NULL DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  details jsonb
);

CREATE INDEX IF NOT EXISTS audit_log_ts_idx ON public.audit_log (ts DESC);
CREATE INDEX IF NOT EXISTS audit_log_user_idx ON public.audit_log (user_id);
CREATE INDEX IF NOT EXISTS audit_log_action_idx ON public.audit_log (action);

GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.audit_log_id_seq TO authenticated;
GRANT ALL ON public.audit_log TO service_role;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read audit log" ON public.audit_log;
CREATE POLICY "Admins read audit log" ON public.audit_log
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated insert audit log" ON public.audit_log;
CREATE POLICY "Authenticated insert audit log" ON public.audit_log
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.has_any_role(auth.uid()));

-- ============================================
-- 6. user_roles: allow admins to manage, users to read own
-- ============================================
DROP POLICY IF EXISTS "Admins manage user roles" ON public.user_roles;
CREATE POLICY "Admins manage user roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
-- "Users can view own roles" policy already exists from earlier migration

-- ============================================
-- 7. Update existing tables' RLS: admin OR user can do day-to-day,
--    admin-only for structural changes (zone add/delete, apartment add/delete,
--    thermostat allocation)
-- ============================================

-- BUILDINGS: admin only
DROP POLICY IF EXISTS "Managers manage buildings" ON public.buildings;
DROP POLICY IF EXISTS "Admins manage buildings" ON public.buildings;
CREATE POLICY "Admins manage buildings" ON public.buildings
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "Users read buildings" ON public.buildings;
CREATE POLICY "Users read buildings" ON public.buildings
  FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));

-- APARTMENTS: admin write, all roles read
DROP POLICY IF EXISTS "Managers manage apartments" ON public.apartments;
DROP POLICY IF EXISTS "Admins manage apartments" ON public.apartments;
CREATE POLICY "Admins manage apartments" ON public.apartments
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "Users read apartments" ON public.apartments;
CREATE POLICY "Users read apartments" ON public.apartments
  FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));

-- ZONE_DEFAULTS: admin can add/delete, user can update (edit defaults)
DROP POLICY IF EXISTS "Managers manage zone defaults" ON public.zone_defaults;
DROP POLICY IF EXISTS "Admins insert zone defaults" ON public.zone_defaults;
DROP POLICY IF EXISTS "Admins delete zone defaults" ON public.zone_defaults;
DROP POLICY IF EXISTS "Roles read zone defaults" ON public.zone_defaults;
DROP POLICY IF EXISTS "Roles update zone defaults" ON public.zone_defaults;

CREATE POLICY "Roles read zone defaults" ON public.zone_defaults
  FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "Roles update zone defaults" ON public.zone_defaults
  FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid()))
  WITH CHECK (public.has_any_role(auth.uid()));
CREATE POLICY "Admins insert zone defaults" ON public.zone_defaults
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins delete zone defaults" ON public.zone_defaults
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- THERMOSTATS: both roles can read+update (setpoint, lock). Only admin can
-- insert/delete/reassign zone or apartment. Column-level restriction enforced
-- in server functions; RLS allows both for UPDATE in general.
DROP POLICY IF EXISTS "Managers manage thermostats" ON public.thermostats;
DROP POLICY IF EXISTS "Roles read thermostats" ON public.thermostats;
DROP POLICY IF EXISTS "Roles update thermostats" ON public.thermostats;
DROP POLICY IF EXISTS "Admins insert thermostats" ON public.thermostats;
DROP POLICY IF EXISTS "Admins delete thermostats" ON public.thermostats;

CREATE POLICY "Roles read thermostats" ON public.thermostats
  FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "Roles update thermostats" ON public.thermostats
  FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid()))
  WITH CHECK (public.has_any_role(auth.uid()));
CREATE POLICY "Admins insert thermostats" ON public.thermostats
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins delete thermostats" ON public.thermostats
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- SCHEDULES: both roles can manage
DROP POLICY IF EXISTS "Managers manage schedules" ON public.schedules;
DROP POLICY IF EXISTS "Roles manage schedules" ON public.schedules;
CREATE POLICY "Roles manage schedules" ON public.schedules
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid()))
  WITH CHECK (public.has_any_role(auth.uid()));

-- SCHEDULE_ASSIGNMENTS: both roles can manage assignments
DROP POLICY IF EXISTS "Managers manage assignments" ON public.schedule_assignments;
DROP POLICY IF EXISTS "Roles manage assignments" ON public.schedule_assignments;
CREATE POLICY "Roles manage assignments" ON public.schedule_assignments
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid()))
  WITH CHECK (public.has_any_role(auth.uid()));

-- THERMOSTAT_READINGS: both roles can read+insert
DROP POLICY IF EXISTS "Managers read readings" ON public.thermostat_readings;
DROP POLICY IF EXISTS "Managers insert readings" ON public.thermostat_readings;
DROP POLICY IF EXISTS "Roles read readings" ON public.thermostat_readings;
DROP POLICY IF EXISTS "Roles insert readings" ON public.thermostat_readings;
CREATE POLICY "Roles read readings" ON public.thermostat_readings
  FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "Roles insert readings" ON public.thermostat_readings
  FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid()));

-- ============================================
-- 8. Seed first admin: grant 'admin' role to all existing auth users
--    who don't yet have any role (covers the current single user)
-- ============================================
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::public.app_role
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id
)
ON CONFLICT DO NOTHING;