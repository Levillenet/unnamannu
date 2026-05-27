# Ebeco Connect API -yhteys

Tällä hetkellä `syncEbecoDevices` arpoo satunnaisia laitteita. Korvataan se oikealla integraatiolla Ebecon REST-rajapintaan, ja lisätään setpointin kaksisuuntainen synkronointi.

## 1. Salaisuudet

Pyydetään `add_secret`-työkalulla turvalomakkeella:
- `EBECO_EMAIL` — kiinteistön yhteisen Ebeco Connect ‑tilin sähköposti
- `EBECO_PASSWORD` — saman tilin salasana

Tunnukset tallennetaan vain backend-secreteinä, eivät päädy selainkoodiin.

## 2. Ebeco-clientti (`src/lib/ebeco.server.ts`)

Server-only helper, joka kapseloi API-kutsut:
- `loginEbeco()` → `POST https://ebecoconnect.com/api/TokenAuth/Authenticate` palauttaa `accessToken`. Tokenia välimuistitetaan globaalisti (~50 min TTL) per worker-instanssi, uudelleenkirjautuminen 401:n yhteydessä.
- `fetchDevices()` → `GET /api/services/app/Devices/UserDevices` palauttaa listan: `id`, `displayName`, `temperatureSet`, `temperatureFloor`, `temperatureRoom`, `powerOn`, `online`, `building`/`apartmentName`.
- `updateDevice(deviceId, { temperatureSet, powerOn? })` → `PUT /api/services/app/Devices/UpdateUserDevice`.

Kaikki kutsut käyttävät `process.env.EBECO_EMAIL` / `PASSWORD` ja heittävät kuvaavat virheet (401 / 5xx).

## 3. Server-funktioiden päivitys (`src/lib/data.functions.ts`)

- **`syncEbecoDevices`** kirjoitetaan uusiksi: kutsuu `fetchDevices()`, upsertaa `thermostats`-tauluun `ebeco_device_id`-avaimella. Uusille laitteille `apartment_id = null` (allokoidaan käsin Laitteet-näkymästä). Olemassa olevien laitteiden `last_seen_at`, `status` (`online`/`offline`) ja `current_setpoint` päivitetään Ebecon arvolla. Palauttaa `{ created, updated, total }`. Lisää lukema `thermostat_readings`-tauluun (room_temp, floor_temp, setpoint).
- **`updateThermostatSetpoint`** (jo olemassa oleva polku settaamiseen) laajennetaan: tietokantapäivityksen jälkeen jos termostaatilla on `ebeco_device_id`, kutsutaan `updateDevice(...)`. Jos Ebeco-kutsu epäonnistuu, palautetaan virhe käyttäjälle ja peruutetaan DB-muutos (tai merkitään `status='offline'`) — käytännössä: koitetaan ensin Ebecoa, vasta onnistumisen jälkeen DB.
- **`applyZoneToThermostats`** (bulk vyöhykkeen tallennus) lähettää muutokset jokaiselle ko. vyöhykkeen termostaatille Ebecoon Promise.allSettled:lla; epäonnistuneet listataan vastauksessa toastin näytettäväksi.

## 4. UI-vihjeet (kevyet)

- Asetukset → Yleiset → "Ebeco Cloud API" -kortti: näytetään yhteyden tila (viimeisin sync, montako laitetta) ja "Testaa yhteys" -nappi, joka kutsuu `syncEbecoDevices` ja näyttää tuloksen toastina.
- Olemassaolevat "Synkronoi Ebecosta" ja vyöhykkeen tallennus-napit toimivat ennallaan, mutta puhuvat nyt oikeaan API:in.

## 5. Tekniset huomiot

- Ebeco Connectin pohjana on ASP.NET Boilerplate -tyyppinen `{ result: { accessToken } }` -vastausmuoto; client purkaa sen huolellisesti.
- Worker-runtime: käytetään pelkkää `fetch`ia (ei Node-only kirjastoja). Tokenin cache `globalThis`issa per worker — riittävä, koska Authenticate on halpa.
- Audit-log: jokainen Ebeco-puolelle tehty muutos kirjataan `audit_log`-tauluun (`action: "ebeco.update"`, `entity_id: thermostat.id`, `details: { setpoint }`).
- RLS: vain `requireSupabaseAuth` -middleware; service rolea ei tarvita.

## Muokattavat / luotavat tiedostot

- **uusi** `src/lib/ebeco.server.ts` — API-clientti
- `src/lib/data.functions.ts` — `syncEbecoDevices`, `updateThermostatSetpoint`, `applyZoneToThermostats` käyttävät clienttiä
- `src/routes/_authenticated.settings.tsx` — Ebeco-kortin tilanäyttö ja testinappi
- secret-pyyntö: `EBECO_EMAIL`, `EBECO_PASSWORD`

Avoin kysymys jos Ebecon API ei vastaakaan tämän mallin mukaan (esim. eri endpoint-polut tuoreessa versiossa): säädetään client kun ensimmäinen kutsu tuottaa vastauksen — tehdään diagnostinen GET ensimmäisessä toteutuksessa ja sovitetaan field-mappaus.
