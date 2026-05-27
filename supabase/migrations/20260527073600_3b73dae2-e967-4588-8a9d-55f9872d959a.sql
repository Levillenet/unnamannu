-- Add new roles to app_role enum. Existing values: 'manager'.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'user';