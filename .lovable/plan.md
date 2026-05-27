## Ongelma

Ebeco-asetusvälilehtien kentät (Sallittu min/max, Anturin käyttötapa, kalibroinnit, Lattian min/max jne.) ovat tyhjiä. Tietokannan tarkistus vahvistaa: termostaateissa `sensor_application`, `sensor_type`, `min_floor_temp`, `max_floor_temp`, `temperature_calibration_room`, `ebeco_settings` ovat kaikki `NULL`. Vain `min_setpoint`/`max_setpoint` ovat oletuksessa (5/35).

Syyt ovat kaksi:

1. **Synkronointia ei ole ajettu** uuden `fetchDevicesDetailed()`-logiikan jälkeen. Edellinen synkka käytti vain `GetUserDevices`-yhteenvetoa, joten yksityiskohtaiset sarakkeet ja `ebeco_settings`-snapshot jäivät tyhjiksi.
2. **Kenttäkartoituksia puuttuu** `ebeco-settings-meta.ts:stä`. `minSetpoint` ja `maxSetpoint` eivät kartoita lokaaleihin sarakkeisiin `min_setpoint`/`max_setpoint`, joten "Sallittu min/max" näkyy tyhjänä vaikka arvot ovat tietokannassa.

## Korjaukset

### 1. `src/lib/ebeco-settings-meta.ts`
Lisää puuttuvat `column`-kartoitukset jotta arvot luetaan myös tietokannan sarakkeista, ei pelkästään `ebeco_settings`-JSONB:stä:
- `minSetpoint` → `column: "min_setpoint"`
- `maxSetpoint` → `column: "max_setpoint"`

### 2. `src/components/ThermostatSettingsTabs.tsx` – `readCurrent`
Korjaa logiikka: nykyinen tarkistaa `thermostat[meta.column] != null`, mutta numeroarvo `0` luetaan oikein. Lisäksi varmistetaan että numerokenttiin tulee numero (ei pelkkä string). Muutetaan myös `Input value`-prop niin että `0` näkyy eikä mene tyhjäksi.

### 3. Käyttäjälle ohje + auto-sync
Lisätään termostaattisivun "Ebeco-asetukset"-kortin yläosaan pieni info + nappi **"Synkronoi tämän termostaatin asetukset Ebecosta"**, joka kutsuu uuden serverFn:n joka hakee yksittäisen laitteen `fetchDeviceById`:llä ja päivittää rivin. Näin käyttäjän ei tarvitse mennä Laitteet-sivulle ajamaan koko sync-eräajoa.

### 4. Uusi serverFn `src/lib/data.functions.ts`
- `syncEbecoDevice({ id })` – hakee yhden termostaatin Ebecosta `fetchDeviceById`:llä ja päivittää kaikki yksityiskohtaiset sarakkeet + `ebeco_settings`-snapshotin. Käyttää samaa kartoituslogiikkaa kuin `syncEbecoDevices`, mutta vain yhdelle laitteelle. Invalidoi `["thermostat", id]` -queryn UI:n puolella.

## Tekninen tarkennus

Nykyinen `readCurrent` lukee ensin DB-sarakkeen ja varakopiona `ebeco_settings`-snapshotin. Kun molemmat ovat `NULL`, kenttä näkyy tyhjänä – tämä on odotettu käyttäytyminen. Synkronoinnin ajamisen jälkeen kentät täyttyvät automaattisesti.

Tämä ei muuta backend-logiikkaa eikä Ebeco-API-integraatiota – pelkästään lisätään yksittäisen laitteen sync-pikanappi ja korjataan kaksi puuttuvaa column-mappausta.
