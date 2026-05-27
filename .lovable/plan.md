## Tavoite

Tehdään ohjauksesta itsenäinen: `pg_cron` kutsuu joka minuutti julkista reittiä, joka ajaa saman enforcement-logiikan kuin selainpolleri. Käyttäjien ei tarvitse pitää sovellusta auki.

## Muutokset

### 1. Uusi julkinen reitti `src/routes/api/public/enforce-limits.ts`

- `POST /api/public/enforce-limits` (myös `GET` salliva manuaalitestiin).
- Vahvistus: vertaa `x-cron-secret`-headeria `process.env.CRON_SECRET`-arvoon `timingSafeEqual`illa. Jos puuttuu/virheellinen → 401.
- Käyttää `supabaseAdmin`-clientiä (`@/integrations/supabase/client.server`) RLS:n ohi.
- Hakee `thermostats` + `zone_defaults` samoilla kentillä kuin nykyinen server fn.
- Kutsuu `runEnforcementForRows(supabaseAdmin, rows, zones)` (uudelleenkäyttö `enforcement.server.ts`:stä, ei koodimuutosta sinne).
- Palauttaa `{ ok: true, actions, count }`.
- Logittaa `console.info("[cron/enforce] actions=…")` jälkikäteistä debugointia varten.

### 2. Salaisuus

- `add_secret CRON_SECRET` — käyttäjä antaa satunnaisen merkkijonon (esim. 32 tavua hex).

### 3. pg_cron -ajastus

Erillinen insert (ei migraatio, koska sisältää salaisuuden ja URL:n):

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'enforce-thermostat-limits',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://project--f9410954-fa6f-4161-babd-ac3c51162c1d.lovable.app/api/public/enforce-limits',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-secret','<CRON_SECRET-arvo>'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

URL on stabiili `project--<id>.lovable.app` jotta uudelleennimet eivät riko.

### 4. Selainpolleri jää paikalleen

Nopea palaute UI:lle kun joku katsoo, mutta ei enää välttämätön. Ei muutoksia `_authenticated.tsx`:ään.

## Tekninen huomio

`runEnforcementForRows` toimii suoraan `supabaseAdmin`illa (sama `from/update/insert`-rajapinta). Ebeco-kutsut menevät `updateDevice`-helperin kautta, joka käyttää `EBECO_EMAIL`/`EBECO_PASSWORD`-secrettejä — toimii server routessa identtisesti.

## Käyttöönotto

1. Käyttäjä hyväksyy → lisätään `CRON_SECRET`.
2. Luodaan reitti.
3. Käyttäjä ajaa SQL:n (kerran) tai pyytää ajamaan supabase insert -työkalulla kun secret on tiedossa.
4. Testaus: `curl -X POST -H "x-cron-secret: …" https://.../api/public/enforce-limits` → nähdään actions.
5. Seuranta: `select * from cron.job_run_details where jobid = (select jobid from cron.job where jobname='enforce-thermostat-limits') order by start_time desc limit 10;`