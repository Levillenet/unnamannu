## Tavoite

Vyöhykeasetukset kevennetään: poistetaan turhat kentät ja muutetaan vyöhykkeet kovakoodatusta listasta (`room`, `bathroom`) dynaamisiksi, jotta manageri voi luoda uusia vyöhykkeitä tarpeen mukaan (esim. "Sauna", "Aula", "Varasto").

## Mitä muuttuu

### 1. Karsitaan vyöhykeasetuksista pois

- `zone_defaults.default_setpoint` → kenttä poistetaan tietokannasta ja UI:sta.
- Zones-sivun "Aseta sama setpoint kaikille vyöhykkeen termostaateille" -nappi ja `applySetpointToAll`-logiikka serveriltä → poistetaan.
- `saveZoneDefault`-server-fn yksinkertaistuu: jää vain `guest_max_setpoint`, `override_grace_minutes`, `applyToAll` (max-arvo kaikille) ja `lockAll`.

Vyöhykkeelle jää siis:
- **Max-lämpötila** (`guest_max_setpoint`) — yläraja jonka yli asiakas ei voi nostaa
- **Palautuksen viive** (`override_grace_minutes`) — minuutit, joita termostaatti odottaa ennen kuin palauttaa arvon takaisin maksimiin

### 2. Dynaamiset vyöhykkeet

Nykyinen `thermostat_zone` -enum (`'room' | 'bathroom'`) korvataan vapaalla `text`-kentällä. Vyöhykkeen "olemassaolo" määräytyy `zone_defaults`-taulun riveistä — eli **luodaan uusi rivi `zone_defaults`-tauluun = luodaan uusi vyöhyke**.

Tietokantamuutokset:
- `ALTER TABLE thermostats ALTER COLUMN zone TYPE text USING zone::text;` (oletus säilyy `'room'`)
- `ALTER TABLE zone_defaults ALTER COLUMN zone TYPE text USING zone::text;`
- Lisätään `zone_defaults`-tauluun `label text` (näyttönimi, esim. "Sauna") sekä uniqueness `(building_id, zone)`-parille (jo on).
- `DROP TYPE thermostat_zone` lopuksi.
- `default_setpoint`-sarake pudotetaan.

### 3. UI: `/zones`-sivu uusiksi

Lista olemassaolevista vyöhykkeistä korteina (haetaan `zone_defaults`-rivit). Per kortti:
- Vyöhykkeen näyttönimi + slug (esim. "Kylpyhuone / `bathroom`")
- Max-lämpötila (slider 5–35 °C, 0.5° askel)
- Palautuksen viive (slider 0–30 min)
- Termostaattien lukumäärä tällä vyöhykkeellä
- "Sovella max kaikkiin" -checkbox + "Tallenna"
- "Lukitse kaikki vyöhykkeen termostaatit" -toggle
- "Poista vyöhyke" -nappi (sallittu vain jos ei yhtään termostaattia käytä sitä)

Sivun yläosaan **"+ Lisää vyöhyke"** -dialogi:
- Näyttönimi (esim. "Sauna")
- Slug (auto-generoidaan nimestä, muokattavissa, vain `[a-z0-9_-]+`)
- Max-lämpötila (oletus 23 °C)
- Palautuksen viive (oletus 2 min)
- Tallenna → uusi rivi `zone_defaults`-tauluun

### 4. Muut kosketuspisteet

Korvataan kovakoodatut `"room" | "bathroom"` -tyypit ja valitsimet:
- `_authenticated.devices.tsx` — allokoinnin zone-valitsin → `Select` joka hakee vaihtoehdot `zone_defaults`-listalta
- `_authenticated.thermostats.$id.tsx` — saman muutoksen vyöhykkeen vaihtoon
- `_authenticated.apartments.tsx` ja `apartments.$id.tsx` — vyöhykkeen näyttäminen käyttää `zone_defaults.label`ia (fallback raakaan stringiin)
- `data.functions.ts` — zod-validaattoreissa `z.string().regex(/^[a-z0-9_-]+$/)`, ei enää enumia
- `seed.functions.ts` — `default_setpoint`-rivit pois, muut säilyy

## Käyttäjäkokemus

- Vakiona järjestelmässä on edelleen `room` ("Huone") ja `bathroom` ("Kylpyhuone") seed-datassa.
- Manageri voi `/zones`-sivulta lisätä esim. "Sauna" (max 45 °C, viive 5 min) → uusi vyöhyke on heti valittavissa termostaatin allokoinnissa.
- Vyöhykkeen poistaminen estyy ystävällisellä virheviestillä jos siihen on liitetty termostaatteja.

## Migraatio olemassaolevalle datalle

Olemassaoleva data säilyy: enum-arvot `'room'` ja `'bathroom'` muuttuvat samannimisiksi teksteiksi. `zone_defaults`-riveihin lisätään `label` jälkikäteen (`'room' → 'Huone'`, `'bathroom' → 'Kylpyhuone'`). `default_setpoint`-sarake pudotetaan; mitään dataa ei menetetä koska kenttää ei käytetä missään logiikassa.

## Tekniset huomiot

- `enforce_pending_overrides()`-funktio toimii edelleen — se hakee `override_grace_minutes`in `zone_defaults`ista vyöhyke-stringin perusteella, joten enumista tekstiin -vaihto ei vaikuta.
- Zone-valitsin (`Select`) hakee listansa samasta `listZoneDefaults`-fn:stä jonka zones-sivu jo käyttää.
- Migraatio tehdään yhdessä SQL-tiedostossa: `ALTER TYPE → text`, sarakkeen pudotus, `label`-lisäys + päivitys, `DROP TYPE`.
