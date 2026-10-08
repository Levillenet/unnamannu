ALTER TABLE public.thermostat_readings ADD COLUMN heating boolean;
COMMENT ON COLUMN public.thermostat_readings.heating IS 'Ebeco relayOn: lämmitysrele päällä lukemahetkellä';