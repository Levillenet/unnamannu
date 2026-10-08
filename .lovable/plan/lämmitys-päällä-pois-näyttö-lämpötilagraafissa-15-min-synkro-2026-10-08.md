# Lämmitys päällä / pois -näyttö lämpötilagraafissa + 15 min synkronointi

## Tausta

Ebeco-rajapinta palauttaa jokaiselle termostaatille kentän `relayOn` (true/false), joka kertoo, syöttääkö termostaatti juuri nyt virtaa lattialämmitykseen — eli "lämmittää / ei lämmitä". Sitä ei vielä tallenneta. Käyttäjä haluaa nähdä lämmitysjaksot suoraan lämpötilagraafissa (värein), jotta lämpötilan muutos ja lämmitys näkyvät samalla, sekä tihentää haun 15 minuutin välein tarkkuuden parantamiseksi.

## Toteutus

### 1. Tallennus
- Migraatio: `alter table thermostat_readings add column heating boolean;` (append-only-taulu, olemassa olevat RLS-politiikat kattavat).
- `ebeco.server.ts`: lisätään `pickHeating(d): boolean | null` (`relayOn`-kentästä; `relayOn` on jo tyypitetty).
- `ebeco-sync.server.ts`: readings-inserttiin `heating: pickHeating(d)`.

### 2. Synkronointi 15 min välein
- pg_cron: `ebeco-sync-5min`-ajo (nyt `0 * * * *`) muutetaan `*/15 * * * *`.
- Etusivun "Seuraava päivitys" -aika (`getBuildingOverview` `nextSyncAt`) lasketaan 15 min syklille.
- Rajavalvonta (`enforce-limits`, `5 * * * *`) jätetään tuntiväliin — se riittää eikä kuluta ylimääräistä.
- Selaimen automaattitarkistus (`_authenticated.tsx`, nyt 3600 s) tihennetään 900 s, jotta graafi päivittyy ruudulla.

### 3. Termostaatin sivu (`/thermostats/$id`)
- Lämpötilagraafiin (huone/lattia) lämmitysjaksot värillisinä taustakaistoina (Recharts `ReferenceArea`): jaksot, joilla `heating = true`, saavat pehmeän lämmön värin taustan — näkee heti, missä kohtaa lämpötila on noussut lämmityksen aikana.
- Graafin yhteyteen yhteenveto: "Lämmittänyt n. X min viimeisen 24 h aikana" (päällä-pisteet × 15 min).
- Huoneistosivun termostaattikorttiin pieni tunniste "Lämmittää nyt", kun viimeisin lukema on päällä.

## Tekniset yksityiskohdat

- Historia alkaa kertyä vasta ensimmäisestä 15 min synkronoinnista muutoksen jälkeen.
- 15 min haku = 96 haku-/päivä/laite-listakutsu (yksi API-kutsu hakee kaikki laitteet kerralla). Palvelinkulu: pyyntöpohjainen hinta on 0,0000015 kr/pyyntö — vaikutus käytännössä mitätön (alle 0,01 kr/kk), ja worker-ajo pysyy ilmaiskiintiössä.
- Graafi käyttää olemassa olevaa Recharts-kirjastoa; ei uusia riippuvuuksia.
