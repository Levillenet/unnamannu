## Tausta

Asiakas voi nostaa termostaatin enintään `guest_max_setpoint`-arvoon. Tällä hetkellä jos asiakas nostaa _maksimiin_, se jää sinne ikuisiksi ajoiksi — vain ylityksen tapauksessa palautus laukeaa (grace minutes → max).

## Uusi käyttäytyminen

Lisätään vyöhykkeille **oletusasetus** ja **max-pitoaika**. Kun termostaatti saavuttaa max-arvon, käynnistyy ajastin; ajan päätyttyä se palautuu oletukseen.

```text
asiakas nostaa max:iin  ──┐
                          ├──→ pitoaika (esim. 6 h) ──→ palautuu default_setpoint:iin
ylittää max:n             │
   └─ grace minutes ──→ palautuu max:iin → pitoaika alkaa
```

## Muutokset

### Tietokanta (`zone_defaults`)
- `default_setpoint numeric NOT NULL DEFAULT 21.0` — vyöhykkeen lepolämpötila
- `max_hold_minutes integer NOT NULL DEFAULT 360` — minuutteja max:ssa ennen palautusta (oletus 6 h)

### Tietokanta (`thermostats`)
- `max_hold_started_at timestamptz` — ajanhetki, jolloin termostaatti saavutti max-arvon

### Triggerit & funktiot
- **`enforce_guest_max()`** — lisää: kun `current_setpoint >= guest_max_setpoint`, asetetaan `max_hold_started_at = now()` (jos ei vielä asetettu). Kun current laskee alle maxin, nollataan `max_hold_started_at`.
- **`enforce_pending_overrides()`** — laajennetaan: käy myös läpi termostaatit, joilla `max_hold_started_at` on vanhentunut (yli `max_hold_minutes`) → asetetaan `current_setpoint = default_setpoint`, kirjataan event `max_hold_expired`.

### UI (`/zones`)
Jokaiselle vyöhykkeelle:
- Slider: **Oletuslämpötila** (5–35 °C, askel 0.5)
- Slider: **Max-pitoaika** (0–24 h, askel 1 h) — 0 = ei automaattipalautusta
- Aiemmat: Max-lämpötila, palautusviive ylityksestä

Lisäysdialogiin samat kentät.

### Server-funktiot (`data.functions.ts`)
- `saveZoneDefault` schemaan lisätään `default_setpoint` ja `max_hold_minutes`
- `createZoneDefault` samoin
- `listZoneDefaults` palauttaa uudet kentät

### Dashboard
- "Pakotettu palautus 24 h" -mittari laskee nyt sekä `guest_max_enforced` että `max_hold_expired` -tapahtumat (tai erotellaan kaksi mittaria — ehdotan yhdistämistä yhdeksi "Automaattiset palautukset").

## Migraatio

```sql
ALTER TABLE public.zone_defaults
  ADD COLUMN default_setpoint numeric NOT NULL DEFAULT 21.0,
  ADD COLUMN max_hold_minutes integer NOT NULL DEFAULT 360;

ALTER TABLE public.thermostats
  ADD COLUMN max_hold_started_at timestamptz;

-- enforce_guest_max() ja enforce_pending_overrides() päivitetään yllä kuvatun mukaisesti
```

Jos OK, aloitan migraatiosta.