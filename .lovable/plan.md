## Tavoite

Tuoda termostaatin anturin mittaama **huonelämpö** (ja kylpyhuoneissa myös **lattialämpö**) näkyviin niihin näkymiin, joissa se nyt puuttuu, sekä selkeyttää termostaatin detaljinäkymän mittarit otsikoilla "Mitattu".

## Mitä lisätään / muutetaan

### 1. `src/lib/data.functions.ts` — `listApartments`

Lisätään `ebeco_settings` termostaatti-selectiin, jotta lista saa käyttöönsä Ebecon viimeisimmän anturilukeman ilman ylimääräistä kyselyä:

```text
.select("*, thermostats(id,name,room,status,current_setpoint,
         guest_max_setpoint,zone,locked,last_seen_at,ebeco_settings)")
```

`getApartment` käyttää jo `thermostats(*)` → ei muutosta.

### 2. `src/routes/_authenticated.apartments.tsx` — listan laajennettu rivi

Termostaattirivi näyttää nyt vain "Asiakas-max … °C". Lisätään näytetyn nimen viereen pieni mitattu lämpö:

- Otetaan `temperatureRoomDecimals` (tai `temperatureRoom`) `ebeco_settings`-jsonista
- Lukema näkyy muodossa `21.3 °C` termostaattirivin oikeassa reunassa Setpoint-stepperin vasemmalla puolella, sekundääritekstinä
- Yläpuolella olevaan apartment-tasoriviin lisätään uusi sarake **"Mitattu ka."** (keskiarvo termostaattien room-lukemista)

### 3. `src/routes/_authenticated.apartments.$id.tsx` — `ThermostatCard`

Kortille (`CardContent`) lisätään asetuksen alle pieni rivi:

```text
Mitattu  21.3 °C huone · 24.1 °C lattia
```

- Huonelämpö aina kun saatavilla
- Lattialämpö vain jos `ebeco_settings.temperatureFloor(Decimals)` ≠ null (kylpyhuonetermostaateissa)
- Jos arvoa ei ole, näytetään "—"

### 4. `src/routes/_authenticated.thermostats.$id.tsx` — selkeytys

Vain labelimuutoksia, ei dataa:
- "Huonelämpötila nyt" → **"Mitattu huone"**
- "Lattia …" → **"Mitattu lattia …"**
- Kaavion selitteet `Huone` ja `Lattia` → **`Mitattu huone`** ja **`Mitattu lattia`** (Asetus pysyy)

## Tekninen huomio

Mittausarvot luetaan ensisijaisesti `ebeco_settings`-jsonista (kentät `temperatureRoomDecimals`, `temperatureFloorDecimals`, fallback ei-decimal-versioon). Tämä on sama logiikka kuin termostaatin detaljisivulla, joten arvot pysyvät synkassa. Polleri päivittää `ebeco_settings`-snapshotin joka minuutti `syncEbecoDevices`-kutsulla.

Ei tietokantamuutoksia, ei uusia kyselyitä, ei taustalogiikan muutoksia.
