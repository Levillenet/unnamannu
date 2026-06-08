## Tausta

Tällä hetkellä `syncEbecoDevices` ajetaan vain selaimessa, kun admin on kirjautuneena ja `_authenticated`-näkymä on auki (interval 60 s tiedostossa `src/routes/_authenticated.tsx`). Jos kukaan ei ole appissa, mitään ei synkronoida — siksi A2OH:n offline-tila ei päivittynyt viikkoon. Tämä korjaa sen ajamalla synkan palvelinpuolella ajastetusti.

## Mitä rakennetaan

1. **Uusi julkinen hook-reitti** `src/routes/api/public/hooks/ebeco-sync.ts`
   - `POST`-handler, joka tarkistaa `apikey`-headerista Supabasen anon-avaimen.
   - Kutsuu samaa Ebeco-sync-logiikkaa kuin nykyinen `syncEbecoDevices`-server function, mutta palveluroolilla (`supabaseAdmin`), koska kutsujana ei ole kirjautunutta käyttäjää.
   - Siirretään nykyinen synkronoinnin sisältö jaettuun apuriin `src/lib/ebeco-sync.server.ts`, jonka sekä alkuperäinen `syncEbecoDevices` että uusi hook käyttävät — näin logiikka pysyy yhtenä paikkana.

2. **pg_cron-ajastus** joka 5 min
   - Käytetään `pg_cron` + `pg_net`. Molemmat extensionit ovat valmiina projektissa (cron-jobi `enforce-thermostat-overrides` toimii jo joka minuutti).
   - Ajastus lisätään `supabase--insert`-työkalulla (ei migraationa, koska sisältää projektikohtaisen URL:n ja anon-avaimen):
     ```
     cron.schedule('ebeco-sync-5min', '*/5 * * * *', net.http_post(...))
     ```
   - Kutsuu URL:ää `https://project--f9410954-fa6f-4161-babd-ac3c51162c1d.lovable.app/api/public/hooks/ebeco-sync` headerilla `apikey: <anon>` ja tyhjällä bodylla.

3. **Pieni siivous selainpuolella**
   - Nykyinen 60 s selainsynkka jätetään ennalleen — siitä on hyötyä kun admin katsoo dashboardia ja haluaa tuoreemman datan kuin 5 min vanhan.
   - Ei muita UI-muutoksia.

## Tekninen huomio

- `ebeco-sync.server.ts` tehdään `.server.ts`-päätteellä, jotta sitä ei voi vahingossa importata client-koodista.
- Hookissa autentikointi: vain `apikey`-tarkistus (vakio `/api/public/*`-pattern). Reitti ei palauta dataa selaimelle vaan vain `{ ok, created, updated }`-yhteenvedon.
- Cron ajaa työn palvelimella, joten myös last_seen_at päivittyy oikein offline-laitteiden osalta (edellisessä turnaussa korjattu `isEbecoOffline`-logiikka säilyy ennallaan).

## Aikatauluvaihtoehto

5 min on tasapaino tuoreuden ja Ebeco-API:n kuormituksen välillä. Jos haluat tiheämmän (esim. 1 min) tai harvemman, kerro niin säädän cron-lausekkeen.
