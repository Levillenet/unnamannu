## Ongelmat

### 1. "Lukitse kaikki termostaatit" -nappi palautuu eikä lukitse Ebecoa

`ZoneCard`-komponentissa `lock`-tila alustetaan kovakoodattuna `useState(false)` – ei ikinä lue todellista tilaa vyöhykkeen termostaateista, joten kytkin palautuu jokaisella renderöinnillä.

Lisäksi `saveZoneDefault`-server fn päivittää vain `thermostats.locked`-saraketta DB:ssä, mutta **ei kutsu Ebecoa** ollenkaan – `childLock`-kenttä jää termostaatilla pois päältä.

### 2. Yksittäiset Ebeco-asetukset (näyttö, kieli, lapsilukko…) eivät mene laitteelle

Lokeista paljastui jo aiemmin että `GetUserDevice?Id=…` palauttaa 400. Korjasin sen käyttämään koko listaa (`GetUserDevices`), mutta DB:ssä `thermostats.ebeco_settings` on edelleen NULL kaikilla laitteilla → eli **emme tiedä mitä kenttiä lista oikeasti palauttaa**. Todennäköisesti `GetUserDevices` palauttaa vain perustiedot (id, name, lämpötila, online), ei laajempia asetuksia kuten `displayWhenIdle`, `childLock`, `language`. Silloin merge-PUT joko hylätään hiljaisesti tai Ebeco ei käsittele kenttiä joita se ei "tunne" listan kontekstissa.

Lisäksi vain yhdellä termostaatilla (`94922`) on numeerinen Ebeco-ID. Muut ovat tekstiplaceholder-arvoja (`EBT500-…`), joten ne eivät koskaan tavoita Ebecoa – tämä on test-dataa eikä korjattavaa, mutta auttaa selittämään miksi "broadcast" näyttäisi useammin epäonnistuvan.

## Suunnitelma

### A. Lukitus-nappi toimimaan oikein (sovellus + Ebeco)

**`src/lib/data.functions.ts` – `saveZoneDefault`:**
- Kun `lockAll === true/false`, hae vyöhykkeen termostaattien ID:t, ja kutsu reusable `pushPatchToTargets(supabase, ids, { childLock: lockAll })`. DB:n `locked`-sarakkeen päivitys tapahtuu jo nyt; lisätään päälle Ebeco-push. `pushPatchToTargets` huolehtii automaattisesti snapshotin tuoreutuksesta.
- Palauta UI:lle myös push-tulokset (`pushed`, `failed`).

**`src/routes/_authenticated.zones.tsx` – `ZoneCard`:**
- Lisätään prop `currentLocked: boolean` joka tulee parentilta (lasketaan: kaikki vyöhykkeen termostaatit `locked=true`).
- `useState(currentLocked)` + `useEffect`-synkki kun prop muuttuu.
- Onnistuneen tallennuksen jälkeen kutsutaan `qc.invalidateQueries`, jolloin uusi tila virtaa oikein takaisin.

### B. Selvitetään miksi Ebeco-asetukset eivät tartu

**`src/lib/ebeco.server.ts` – `updateDevice`:**
- Lisätään tarkka diagnostiikka onnistumistilanteessakin: kirjataan `console.log` jossa `id`, `base`-avaimet (ennen PUTia), ja Ebecon vastausrunko (`response.json()` jos ei tyhjä). Näin lokeista nähdään tarkalleen mitä lähetetään ja mitä Ebeco vastaa.
- Yritetään kahta vaihtoehtoista single-device endpointia ennen lista-fallbackia (helper `fetchDeviceById`):
  1. `GET /services/app/Devices/Get?Id={id}`
  2. `GET /services/app/Devices/GetUserDeviceById?Id={id}`
  
  Ensimmäinen joka palauttaa `{ result: { id, displayWhenIdle, … } }` valitaan – cachetetaan onnistunut polku moduuliskoopissa jotta seuraavat kutsut menevät suoraan.
- Jos kumpikaan ei toimi, pysytään lista-fallbackissa (nykyinen toiminta) ja ainakin diagnostiikan kautta nähdään mitä lista palauttaa.

### C. Mitä EI tehdä

- Ei kosketa `syncEbecoDevices`-liittymäpintaan (toimii muuten ok).
- Ei muuteta UI:n asetus-meta-dataa.
- Ei poisteta test-data-rivejä `thermostats`-taulusta – käyttäjän asia.

## Lopputulos

- Lukitus-kytkin näyttää oikean tilan ja painalkin tekee saman muutoksen sekä DB:hen että Ebecoon, jolloin lapsilukko aktivoituu myös termostaatissa.
- Lokeista näemme heti yhden tallennuksen jälkeen miksi Ebeco-asetukset eivät tartu (puuttuvat kentät vs. virheellinen polku), ja päästään korjaamaan se täsmällisesti seuraavalla iteraatiolla.
