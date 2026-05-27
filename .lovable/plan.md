## Ongelma

1. **Tallenna ei synkronoi takaisin** – kun käyttäjä painaa Tallenna asetusriviltä, kutsumme Ebecoa, mutta emme päivitä paikallista snapshotia. Käyttäjä joutuu painamaan erikseen "Synkronoi Ebecosta" nähdäkseen tilanteen.
2. **Jaa monelle termostaatille -toiminto** tekee saman virheen – ei päivitä snapshoteja kohdelaitteille.
3. **Lokeista paljastui:** `GET /services/app/Devices/GetUserDevice?Id=…` ei ole olemassa (Ebeco palauttaa `400: "GetUserDevice" is not valid`). Eli `fetchDeviceById` epäonnistuu aina, ja `updateDevice` joutuu nykyään aina varakeinolle (`fetchDevices`) per kutsu → hidasta.

## Ratkaisu

### 1. `src/lib/ebeco.server.ts`

- **Poista** rikkinäinen single-device endpoint -kutsu `fetchDeviceById`-funktiosta. Hae aina tieto `fetchDevices()`-listasta. Pidä funktion julkinen rajapinta samana, jotta `data.functions.ts` toimii muuttumattomana.
- `updateDevice`: nykyinen logiikka (hae täysi DTO ennen PUT:ia) säilyy, mutta haku menee nyt suoraan `fetchDevices`-listaan.
- **Lisää** `fetchAndCacheDevice(id)`-helperi: hakee laitteen listalta ja palauttaa sen – käytetään tallennuksen jälkeen snapshotin tuoreutukseen.

### 2. `src/lib/data.functions.ts` – `pushPatchToTargets`

Onnistuneen `updateDevice`-kutsun jälkeen jokaiselle laitteelle:
- Hae tuore tila Ebecosta (yksi `fetchDevices()`-kutsu kierrosta kohden, ei per-laite, tehokkuuden takia).
- Päivitä `thermostats`-riville sekä `ebeco_settings` (koko JSON) että kaikki `EBECO_TO_COLUMN`-mappaukset annetun patchin sijaan **tuoreesta tilasta**.
- Aseta `last_seen_at = now()` ja `status` online/offline-arvon mukaan.

Tämä tarkoittaa että `updateThermostatSettings` (Tallenna) ja `broadcastThermostatSetting` (Jaa monelle) hoitavat synkronoinnin automaattisesti – ei tarvitse erillistä "Synkronoi Ebecosta" -painalkutta.

### 3. `syncEbecoDevice` säilyy

Manuaalinen "Synkronoi Ebecosta" -painike jää – käytetään kun halutaan päivittää näkymä ilman muutoksia (esim. asiakkaan tekemä säätö termostaatilla). Ei muutosta toiminnallisuuteen.

### 4. UI-virhe (`SSR rendering failed` / `Cannot read properties of undefined (reading 'method')`)

Lokeissa näkyy myös erillinen serverFn-virhe. Tarkistetaan että edellisen muutoksen jälkeen `updateThermostat`-skeemasta poistettu `sync_guest_max_to_device`-kenttä ei aiheuta clientillä yhä jossain `data: { ..., sync_guest_max_to_device }` -kutsua, joka kaatuisi serialisointivaiheessa. Käydään `grep`illä läpi ja korjataan jos löytyy.

## Lopputulos

- Yhdellä tallennuksella sekä termostaatti että näkymä ovat ajan tasalla.
- Jaa-toiminto tekee saman kaikille kohteille kerralla.
- Ei enää turhia 400-virheitä Ebecon API:lta.
