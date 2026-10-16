# Lämmitysaste-näkymän aineisto alkaa korjauksen hetkestä (15.10. klo 21)

## Tavoite

Lämmitysaste-sivu (ja termostaattisivun lämmitysyhteenveto) laskee lämmitysprosentit vain ajalta, jolta mittausdataa on oikeasti kertynyt — eli 15.10.2026 klo 21.00 (UTC) alkaen, jolloin 15 min synkronointi korjautui. Sitä aiempi puutteellinen vuorokausi ei enää vääristä prosentteja.

## Toteutus

### 1. Yhteinen "aineiston alkupiste"
- Vakio `DATA_VALID_FROM = "2026-10-15T21:00:00Z"` (esim. `src/lib/heating-status.ts` tai uusi pieni moduuli), jota kaikki laskennat käyttävät.

### 2. `getHeatingDuty` (`src/lib/data.functions.ts`)
- Mittausten haku rajataan: `ts >= max(nyt - 24 h, DATA_VALID_FROM)`.
- Lämmitysaste % lasketaan kuten nyt, mutta jakajana käytetään todellista aineiston pituutta (alkupisteestä nyt-hetkeen), ei kiinteää 24 h — näin prosentti on vertailukelpoinen heti alusta alkaen.
- `samples24h`-kenttä ja odotettu määrä lasketaan samasta ikkunasta, jotta "vain N mittausta" -huomautus ei hälytä turhaan.
- 4 h -sarake lasketaan normaalisti (4 h on jo kokonaan puhdasta aineistoa).

### 3. Termostaattisivun yhteenveto (`_authenticated.thermostats.$id.tsx`)
- "Lämmittänyt n. X min" lasketaan samalla alkupisteellä; odotettu pistemäärä skaalautuu aineiston pituuden mukaan.

### 4. Käyttöliittymähuomautus
- Lämmitysaste-sivun yläreunaan pieni infoteksti: "Aineisto kertyy 15.10. klo 21 alkaen — prosentit tarkentuvat, kun dataa on kertynyt täysi vuorokausi."

## Huomioita
- Kun puhdasta dataa on kertynyt yli 24 h (16.10. klo 21 jälkeen), laskenta siirtyy automaattisesti normaaliin liukuvaan 24 h ikkunaan — vakiota ei tarvitse poistaa, mutta sen voi siivota myöhemmin.
- Ei tietokantamuutoksia; pelkkä laskennan ja esityksen rajaus.

## Tekniset tiedot
- Tiedostot: `src/lib/data.functions.ts` (`getHeatingDuty`), `src/lib/heating-status.ts`, `src/routes/_authenticated.heating.tsx`, `src/routes/_authenticated.thermostats.$id.tsx`.
- Muutokset tulevat tuotantoon julkaisun yhteydessä.
