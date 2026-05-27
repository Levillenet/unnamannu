
# Ebeco-asetusten täysi hallinta + per-kenttä broadcast

## Tavoite

1. Hae ja tallenna Ebeco-rajapinnan kaikki säädettävät asetukset jokaiselle termostaatille.
2. Näytä ne termostaattikortilla ryhmiteltynä osioihin.
3. Lisää **jokaisen yksittäisen asetuksen viereen "Käytä myös..." -nappi**, josta voi valita kohdejoukon (kaikki / sama vyöhyke / sama huoneisto / sama talo) ja ajaa muutoksen kerralla.
4. Laitteet-sivulle erillinen "Keskitetyt asetukset" -kortti samasta toiminnosta laajemmassa lomakkeessa.

## Tuettavat Ebeco-asetukset

**Lämpötila & säätö**
- `temperatureSet`, `minSetpoint`, `maxSetpoint`
- `temperatureCalibrationRoom`, `temperatureCalibrationFloor`
- `adaptiveStart`, `openWindowDetection`, `openWindowSensitivity`

**Anturi**
- `sensorApplication` (`floor` / `room` / `roomAndFloor`)
- `sensorType` (NTC 10k/12k/15k/22k/33k/47k)
- `minFloorTemp`, `maxFloorTemp`, `floorTempCutOff`

**Näyttö**
- `displayWhenIdle` (`off` / `dateAndTime` / `temperature` / `temperatureAndTime`)
- `lightLedTextWhenIdle` (0–100), `lightLedTextDuringOperation` (0–100)
- `screenSaverEnabled`, `language`, `timeFormat`, `dateFormat`

**Lukitus**
- `childLock`, `pinCodeEnabled`, `installerLock`

**Ohjelma**
- `selectedProgram` (`home` / `away` / `vacation` / `schedule` / `manual`)
- `awayTemperature`, `vacationFrom`, `vacationTo`, `vacationTemperature`

**Asennus**
- `installedEffect` (W), `regulatorMode`, `pwmPeriod`

**Perustiedot**
- `displayName`, `powerOn`

Snapshot koko vastauksesta säilyy myös JSONB-kenttänä `ebeco_settings`.

## Tietokantamuutos

Migraatio lisää `thermostats`-tauluun:
- `ebeco_settings jsonb` (täysi snapshot Ebecosta)
- Yleisimmät kentät omina sarakkeina suodatusta ja näyttölistoja varten: `sensor_application`, `sensor_type`, `display_when_idle`, `light_idle`, `light_active`, `child_lock`, `selected_program`, `installed_effect_w`, `adaptive_start`, `open_window_detection`, `temperature_calibration_room`, `temperature_calibration_floor`, `min_floor_temp`, `max_floor_temp`, `floor_temp_cut_off`, `language`

## Backend (server functions)

`src/lib/ebeco.server.ts`
- Laajenna `EbecoDevice`-tyyppi kaikilla yllä mainituilla kentillä.
- `updateDevice(input)` hyväksyy minkä tahansa osajoukon kentistä ja lähettää ne `PUT /services/app/Devices/UpdateUserDevice` -kutsuun.

`src/lib/data.functions.ts`
- `syncEbecoDevices`: tallenna kaikki tuetut kentät sekä omiin sarakkeisiin että `ebeco_settings`-JSONB:hen.
- **Uusi** `updateThermostatSettings({ id, patch })`: lähettää patchin Ebecoon ja päivittää lokaalin rivin.
- **Uusi** `broadcastThermostatSetting({ source_id, patch, scope })` jossa
  - `scope = { kind: "all" } | { kind: "zone", zone } | { kind: "apartment", apartment_id } | { kind: "building", building_id }`
  - kerää kohdetermostaattien `ebeco_device_id`:t (vain joilla `apartment_id` asetettu ja `ebeco_device_id` olemassa)
  - ajaa `Promise.allSettled`-rinnakkain Ebeco-päivitykset
  - päivittää lokaalit rivit ja palauttaa `{ total, succeeded, failed, errors }`

## UI – termostaattikortti `/thermostats/$id`

Uusi rakenne: yläosa pysyy (nimi, status, lämpötila), sen alla välilehdet:
- **Lämpötila** · **Anturi** · **Näyttö** · **Lukitus** · **Ohjelma** · **Asennus**

Jokaisessa rivissä:
```text
[ Label ]   [ kenttä / select / slider ]   [ Tallenna ]   [ ⋯ Käytä myös ▾ ]
```

**"Käytä myös" -popover** (oma komponentti `BroadcastButton`):
- Otsikko: "Käytä tämä asetus myös…"
- Painikkeet:
  - Kaikkiin termostaatteihin (n kpl)
  - Vyöhykkeelle "{label}" (n kpl)
  - Huoneistoon {numero} (n kpl)
  - Talon "{nimi}" termostaatteihin (n kpl)
- Vahvistus + toast-yhteenveto: "Päivitetty 11/12 (1 offline)"

Vyöhyke/huoneisto/talo luetaan termostaatin omasta rivistä; lukumäärät esilasketaan `listDevices`-vastauksesta.

## UI – Laitteet-sivu `/devices`

Lisää uusi kortti **"Keskitetyt asetukset"** allokointi-osioiden yläpuolelle:
- Valitse kohdejoukko (radio: kaikki / vyöhyke / huoneisto / talo)
- Lomake yleisimmistä kentistä: displayWhenIdle, lightIdle, lightActive, childLock, adaptiveStart, openWindowDetection, sensorApplication, selectedProgram, language
- "Käytä valittuihin" → `broadcastThermostatSetting` (yksi kutsu per muutettu kenttä)
- Tulostoasti yhteenvedolla

## Tekniset yksityiskohdat

- Kaikki rajapintakentät tyypitetään `EbecoSettingsPatch`-tyypille (zod-skeema), jota sekä `updateThermostatSettings` että `broadcastThermostatSetting` käyttävät `inputValidator`issaan.
- Broadcastissä suodatetaan pois lähde-termostaatti `source_id` *vain jos* käyttäjä on jo tallentanut sen erikseen — muuten se sisältyy mukaan.
- Offline-laitteet (status ≠ online) yritetään silti; Ebeco API-virhe → kirjataan `failed`-listalle ja toastiin.
- Audit-log: `broadcast_settings`-merkintä jokaisesta broadcast-toiminnosta (`scope`, `patch`, `succeeded/failed`).
- Lokalisointi: kaikki labelit ja enum-vaihtoehdot suomeksi (esim. `displayWhenIdle` → "Päivämäärä ja kello", "Lämpötila", "Pimeä", "Lämpötila + kello").

## Toteutusjärjestys

1. Migraatio: lisää sarakkeet ja `ebeco_settings` JSONB.
2. `ebeco.server.ts`: laajenna tyypit + `updateDevice`-payload.
3. `data.functions.ts`: päivitä `syncEbecoDevices` + lisää `updateThermostatSettings` ja `broadcastThermostatSetting`.
4. `BroadcastButton`-komponentti (popover + scope-valinta).
5. Uusi termostaattikortti välilehdillä, joka käyttää `BroadcastButton`ia.
6. Laitteet-sivun "Keskitetyt asetukset" -kortti.
7. Aja `Synkronoi Ebecosta` → varmista että kaikki kentät tulevat ja tallentuvat.
