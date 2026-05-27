## Muutokset

### 1. Tietomalli (migraatio)
- Poistetaan `apartments.resident_name` -sarake. Huoneen numero (`number`) on tunniste.
- `thermostats`-tauluun:
  - `zone` (enum `bathroom` | `room`) — vyöhyke
  - `guest_max_setpoint numeric` — asiakkaan yläraja
- Uusi taulu `zone_defaults` (per `building_id` + `zone`): `guest_max_setpoint`, `default_setpoint`.
- Trigger `enforce_guest_max` ennen `thermostats`-päivitystä: jos `current_setpoint > guest_max_setpoint`, palautetaan rajaan ja kirjataan `thermostat_readings`-tauluun ylitystapahtuma.

### 2. Seed-päivitys
- 26 hotellihuonetta, 2–4 termostaattia per huone, vyöhykkeet automaattisesti `room`-kentän nimen perusteella (kylpyhuone/wc → bathroom).
- Oletukset: huone `guest_max = 23 °C`, kylpyhuone `guest_max = 25 °C`.

### 3. UI
- **Huoneet-lista** (`/apartments`): poistetaan asukassarake, näytetään huoneen numero, kerros, termostaattien määrä, status.
- **Huonenäkymä** (`/apartments/$id`): termostaatit ryhmitelty otsikoiden alle "Huone" ja "Kylpyhuone". Per termostaatti: nykyinen lämpö, asetusarvo, asiakkaan yläraja, lukko.
- **Uusi sivu `/zones`** (Vyöhykeasetukset): kaksi korttia (Huoneet, Kylpyhuoneet). Per kortti: oletus-setpoint, asiakkaan maksimi, painike "Sovella kaikkiin tämän vyöhykkeen termostaatteihin". Sidebariin uusi linkki.
- **Termostaattinäkymä** (`/thermostats/$id`): erillinen "Asiakkaan yläraja" -slider. Indikaattori jos viimeisin yritys palautettiin rajaan.
- **Dashboard**: lisätään mittari "Asiakas-ylityksiä 24 h" ja vyöhykekohtainen keskilämpö.

### 4. Sanasto
Kaikki "Asukas" / "resident" tekstit pois UI:sta. "Apartments" → "Huoneet".

Toteutan tämän nyt.