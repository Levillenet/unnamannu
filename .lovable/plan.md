## Tavoite

Manageri painaa "Synkronoi Ebecosta" → järjestelmä hakee Ebeco-tilin laitteet → uudet laitteet ilmestyvät **Allokoimattomat termostaatit** -listalle → manageri allokoi jokaisen huoneistoon, antaa nimen ("Makuuhuone", "Kylpyhuone" jne.) ja zonen (huone/kylpyhuone). Tässä vaiheessa Ebeco-haku on mock — oikea API-kutsu kytketään myöhemmin samaan funktioon.

## Tietomalli (pienet muutokset)

- `thermostats.apartment_id` muutetaan **nullable** → allokoimaton laite voi olla tietokannassa ilman huoneistoa.
- `thermostats.ebeco_device_id` saa **unique-constraintin** → estää saman laitteen tuonnin kahdesti.
- `thermostats.name` täytetään aluksi Ebecon antamalla nimellä (esim. "EB-12345"), manageri muokkaa sen kuvaavaksi allokoidessa.
- Ei erillistä `rooms`-taulua — `name` riittää (käyttäjän vahvistama valinta).

## Backend — uudet server-funktiot (src/lib/data.functions.ts)

1. **`syncEbecoDevices`** (mock toistaiseksi)
   - Palauttaa listan "Ebeco-laitteita": `[{ ebeco_device_id, ebeco_name, online }, ...]`
   - Generoi muutaman uuden ID:n jokaisella kutsulla + sisällyttää olemassa olevat tietokannan laitteet
   - Tekee upsertin `thermostats`-tauluun: uudet laitteet luodaan `apartment_id = NULL`, `name = ebeco_name`, `zone = 'room'` oletuksena
   - Päivittää `last_seen_at` ja `status` olemassa oleville
2. **`listUnallocatedThermostats`** — palauttaa termostaatit joilla `apartment_id IS NULL`
3. **`allocateThermostat({ id, apartment_id, name, zone })`** — asettaa allokoinnin yhdellä kutsulla
4. **`unallocateThermostat({ id })`** — vapauttaa termostaatin takaisin allokoimattomien listalle (säilyttää historian)

## UI

### Uusi sivu: `/devices` (sivupalkkiin "Laitteet")

```text
┌──────────────────────────────────────────────────────────┐
│ Laitteet                       [ Synkronoi Ebecosta ↻ ]  │
├──────────────────────────────────────────────────────────┤
│ Allokoimattomat (3)                                      │
│                                                          │
│ • EB-48201   online                                      │
│   Huoneisto: [Valitse ▾]  Nimi: [_______]                │
│   Vyöhyke: ( ) Huone  ( ) Kylpyhuone     [ Allokoi ]     │
│                                                          │
│ • EB-48202   online    ...                               │
├──────────────────────────────────────────────────────────┤
│ Allokoidut (24)                                          │
│   EB-12001 → Huoneisto 1 / "Makuuhuone" (huone)  [Muokk.]│
│   ...                                                    │
└──────────────────────────────────────────────────────────┘
```

- Synkka-nappi: kutsuu `syncEbecoDevices`, näyttää toastin "X uutta laitetta löytyi".
- Allokoimattomat-lista: jokaisella rivillä Select huoneistolle, Input nimelle, RadioGroup vyöhykkeelle, **Allokoi**-nappi.
- Allokoidut-lista: nykyiset termostaatit huoneistoittain ryhmiteltynä, jokaisella **Vapauta** + **Muokkaa**-toiminnot.

### Pieni lisäys: huoneistokortti
- Huoneiston laajennetussa rivissä (`_authenticated.apartments.tsx`) lisätään pieni **"+ Lisää termostaatti"** -linkki, joka avaa allokointidialogin allokoimattomien listalta.

### Termostaatin asetussivu (`_authenticated.thermostats.$id.tsx`)
- Lisätään **Vapauta laite** -nappi (palauttaa allokoimattomien listalle).
- Apartment-Select, jolla termostaatti voidaan siirtää toiseen huoneistoon.

## Mock-data muutokset

`src/lib/seed.functions.ts` — lisää siemenvaiheessa 2–3 "Ebeco-laitetta" jotka jäävät allokoimattomiksi (esimerkkidata että UI ei ole tyhjä).

## Migraatio

```sql
ALTER TABLE public.thermostats ALTER COLUMN apartment_id DROP NOT NULL;
CREATE UNIQUE INDEX thermostats_ebeco_device_id_key
  ON public.thermostats (ebeco_device_id)
  WHERE ebeco_device_id IS NOT NULL;
```

## Mikä jää myöhemmäksi

- **Oikea Ebeco API -integraatio**: `syncEbecoDevices` korvataan oikealla fetch-kutsulla Ebeco Connect API:in (tunnukset `add_secret`-työkalulla, esim. `EBECO_USERNAME`, `EBECO_PASSWORD`). Funktion sopimus pysyy samana, joten UI ei muutu.
- **Bulk-allokointi** (esim. valitse useita kerralla samaan huoneistoon) — voidaan lisätä jos tarpeen.
- **Nimeämiskäytäntö Ebecossa + automäppäys** — jos myöhemmin haluatte että Ebeco-nimi "A12-Makuuhuone" parsitaan automaattisesti huoneistoon 12, lisätään parseri `syncEbecoDevices`-funktioon.
