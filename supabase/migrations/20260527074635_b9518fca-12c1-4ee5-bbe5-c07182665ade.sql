
-- 1) Schema muutokset
ALTER TABLE public.apartments
  ADD COLUMN IF NOT EXISTS apartment_type text,
  ADD COLUMN IF NOT EXISTS bedrooms integer;

ALTER TABLE public.apartments
  ALTER COLUMN floor TYPE text USING floor::text;

-- Uniikkirajoitus rakennuksen sisällä
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'apartments_building_number_key'
  ) THEN
    ALTER TABLE public.apartments
      ADD CONSTRAINT apartments_building_number_key UNIQUE (building_id, number);
  END IF;
END $$;

-- 2) Varmista että ainakin yksi rakennus on olemassa
INSERT INTO public.buildings (name)
SELECT 'Unna Mànnu'
WHERE NOT EXISTS (SELECT 1 FROM public.buildings);

-- 3) Esitäytä huoneistot
WITH b AS (SELECT id FROM public.buildings ORDER BY created_at LIMIT 1)
INSERT INTO public.apartments (building_id, number, floor, apartment_type, bedrooms, size_m2)
SELECT b.id, v.number, v.floor, v.apt_type, v.bedrooms, v.size_m2
FROM b, (VALUES
  ('A1',  '2',   '2mh+oh/k+saunaos.', 2, 59.5),
  ('A2',  '2',   '2mh+oh/k+saunaos.', 2, 69),
  ('A3',  '2',   '2mh+oh/k+saunaos.', 2, 56),
  ('A4',  '2',   '2mh+oh/k+saunaos.', 2, 71.5),
  ('A5',  '2',   '2mh+oh/k+saunaos.', 2, 70),
  ('A6',  '2',   '2mh+oh/k+saunaos.', 2, 69),
  ('A7',  '2',   '2mh+oh/k+saunaos.', 2, 54.5),
  ('A8',  '3',   '2mh+oh/k+saunaos.', 2, 59.5),
  ('A9',  '3',   '2mh+oh/k+saunaos.', 2, 69),
  ('A10', '3',   '1mh+oh/k+saunaos.', 1, 42),
  ('A11', '3',   'studio+saunaos.',   0, 32),
  ('A12', '3',   '2mh+oh/k+saunaos.', 2, 69),
  ('A13', '3',   '2mh+oh/k+saunaos.', 2, 55),
  ('A14', '4',   '4mh+oh/k+takkah.+kylpylä os.+3kylpyh.', 4, 301.5),
  ('A15', '4',   'studio+kylpyh.',    0, 46.5),
  ('B1',  '2-3', '4mh+oh+takkah.+parvi+kylpyläos.+4kylpyh.', 4, 243.5),
  ('B2',  '2-3', '4mh+oh/k+saunaos.', 4, 112),
  ('B3',  '2-3', '3mh+oh/k+saunaos.', 3, 103),
  ('C1',  '2-3', '4mh+oh/k+saunaos.+kylpyh.', 4, 107.5),
  ('C2',  '2',   '1mh+oh/k+saunaos.', 1, 54),
  ('C3',  '2-3', '3mh+oh/k+takkah.+saunaos.+2kylpyh.', 3, 118),
  ('C4',  '2-3', '3mh+oh/k+takkah.+saunaos.+2kylpyh.', 3, 117.5),
  ('C5',  '2',   '1mh+oh/k+saunaos.', 1, 54),
  ('C6',  '2-3', '3mh+oh/k+saunaos.', 3, 100.5)
) AS v(number, floor, apt_type, bedrooms, size_m2)
ON CONFLICT (building_id, number) DO UPDATE
  SET floor = EXCLUDED.floor,
      apartment_type = EXCLUDED.apartment_type,
      bedrooms = EXCLUDED.bedrooms,
      size_m2 = EXCLUDED.size_m2;
