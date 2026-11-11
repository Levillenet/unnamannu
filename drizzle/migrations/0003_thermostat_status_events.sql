CREATE TABLE public.thermostat_status_events (
  id bigserial primary key,
  thermostat_id uuid not null references public.thermostats(id) on delete cascade,
  status text not null,
  ts timestamptz not null default now(),
  error_message text
);
CREATE INDEX thermostat_status_events_tid_ts ON public.thermostat_status_events(thermostat_id, ts desc);
GRANT SELECT, INSERT ON public.thermostat_status_events TO authenticated;
GRANT ALL ON public.thermostat_status_events TO service_role;
GRANT USAGE ON SEQUENCE public.thermostat_status_events_id_seq TO authenticated, service_role;
ALTER TABLE public.thermostat_status_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Roles read status events" ON public.thermostat_status_events FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "Roles insert status events" ON public.thermostat_status_events FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid()));
INSERT INTO public.thermostat_status_events (thermostat_id, status, ts, error_message)
SELECT id, 'offline', last_seen_at + interval '1 minute', ebeco_settings->>'errorMessage' FROM public.thermostats WHERE status = 'offline' AND last_seen_at IS NOT NULL;