
ALTER TABLE public.thermostats ALTER COLUMN apartment_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS thermostats_ebeco_device_id_key
  ON public.thermostats (ebeco_device_id)
  WHERE ebeco_device_id IS NOT NULL;
