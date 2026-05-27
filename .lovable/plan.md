# Huonelämpötilan näyttö + automaattinen rajojen pakottaminen

## Ongelma

1. Termostaatin **oikea huonelämpötila** (Ebecon `temperatureRoom`) ei näy missään isolla.
2. Termostaatille **fyysisesti asetettu lämpötila ei päivity UI:hin** — `current_setpoint` haetaan vain sivun latauksessa, ei automaattisesti.
3. **Asiakas-ylärajan pakotus ei toimi**: DB-funktiot olemassa, mutta ei triggeriä eikä ajastusta → 29 °C jää roikkumaan vaikka guest_max 23.5 ja palautusviive 0 min.
4. UI varoittaa "palautuu rajaan tallennettaessa" — valhe, koska serveri ei oikeasti clampaa.

## Tavoitetila

- Termostaattisivulla näkyy isolla **nykyinen huonelämpötila** + pieni lattialämpötila + "päivitetty X sitten".
- Asetuspiste näkyy sellaisena kuin se on Ebecossa (myös fyysisesti termostaatista muutettu).
- Kun asetuspiste > guest_max: sovellus pakottaa sen guest_maxiin palautusviiveen jälkeen.
- Kun asetuspiste ≥ guest_max max-pitoajan verran: sovellus pakottaa vyöhykkeen oletukseen JA nollaa `selected_program`/aikataulun.
- Pakotuksesta ilmoitetaan UI:ssä toastilla "Asetus palautettu rajaan 23.5 °C".
- Termostaattikorttiin tulee laskuri: "Palautuu rajaan X min kuluttua".

## Toteutus

### 1. Polleri + auto-refetch — `src/routes/_authenticated.tsx`

- Lisää layoutin sisään 60 s `setInterval`, joka kutsuu:
  - uusi `enforceThermostatLimits` server fn (kts. kohta 3),
  - `syncEbecoDevices` (jo olemassa) — tuo tuoreet temperatureRoom + temperatureSet kantaan.
- Jos enforce palauttaa `clamped` tai `demoted` > 0, näytä toast jokaisesta tapahtumasta (lista palautetaan).
- Invalidoi `["thermostat", id]`, `["devices"]`, `["overview"]` queryt jokaisen syklin jälkeen.

### 2. UI: huonelämpötila + asetuspiste-päivitys — `src/routes/_authenticated.thermostats.$id.tsx`

- "Ohjaus"-kortin yläosaan iso `roomTemp.toFixed(1) °C`, lähde `t.ebeco_settings.temperatureRoom` (tai uusin `thermostat_readings.room_temp` fallback).
- Pienempänä: lattialämpötila, "päivitetty X sitten" (`last_seen_at`).
- Aseta `qo(id)` queryyn `refetchInterval: 60_000` että sivulla auki ollessaan tieto elää.
- Jos `current_setpoint > guest_max_setpoint`:
  - näytä warning-banner: "Asetus 29 °C ylittää asiakkaan ylärajan — palautuu rajaan **X min kuluttua**" (laskee `override_started_at + grace_minutes` perusteella; jos `override_started_at` on null, näyttää grace-minutes kokonaan).
- Päivitä slider-varoitusteksti vastaamaan totuutta: "Asetus rajoittuu asiakkaan ylärajaan tallennettaessa."

### 3. Uusi server fn `enforceThermostatLimits` — `src/lib/enforcement.functions.ts` + `enforcement.server.ts`

Logiikka:
1. Hae kaikki termostaatit + niiden vyöhykkeen `zone_defaults` (grace, hold, default).
2. **Override-clamp**: jos `current_setpoint > guest_max`:
   - jos `override_started_at` null → aseta now.
   - jos `now - override_started_at >= grace_minutes` → clamppaa: päivitä `current_setpoint = guest_max`, nollaa `override_started_at`, lähetä Ebecolle `temperatureSet`, kirjoita reading `event: 'guest_max_enforced'`. Lisää tulokseen `{ id, name, from, to: guest_max, reason: 'guest_max' }`.
3. **Max-hold demote**: jos `current_setpoint >= guest_max` ja `max_hold_started_at` vanhentunut (`hold_minutes > 0`):
   - päivitä `current_setpoint = default_setpoint`, nollaa `max_hold_started_at` + `selected_program = null` + `current_schedule_id = null`, lähetä Ebecolle `temperatureSet` + `selectedProgram: 'manual'` (tai jätä pois jos Ebeco ei tue nullia).
   - kirjoita reading `event: 'max_hold_expired'`. Lisää tulokseen `{ ..., reason: 'max_hold' }`.
4. Override/max_hold-aloitusajat: päivitä myös silloin kun `current_setpoint` muuttui Ebecon synkkaa kautta (eli aseta `override_started_at = now` jos kannassa null mutta setpoint > guest_max).

Palauttaa `{ actions: Array<{id, name, from, to, reason}> }`. Polleri näyttää toastin per action.

### 4. Serverin clamp `updateThermostat`-funktioon — `src/lib/data.functions.ts`

Kun käyttäjä siirtää slideria itse:
- Jos `patch.current_setpoint` annettu ja se > efektiivinen guest_max → **älä clamppaa heti**, vaan päästä yli mennyt arvo läpi (että pollerin grace-logiikka toimii ennustettavasti). Tämä on jo nykyinen käytös.
- Mutta lisää: jos arvo on yli, aseta `override_started_at = now()` samassa updatessa, jotta polleri laskee viiveen oikein heti.

### 5. UI-laskuri palautukseen — termostaattisivun warning-banner

Lasketaan kuluva aika clientillä:
```
remainingMs = (override_started_at + grace_minutes * 60_000) - now
```
- näytä `Math.ceil(remainingMs / 60_000)` min.
- jos `grace_minutes = 0` → "Palautuu seuraavalla tarkistuksella (≤60 s)".

### 6. Vyöhykesivun tekstin korjaus

`zones.tsx` palautusviive-selitys: "Aika jonka jälkeen sovellus pakottaa asetuksen takaisin asiakkaan ylärajaan jos asetus on viety yli. 0 = pakotus seuraavalla tarkistussyklillä (~60 s)."

## Tiedostot

- **Uusi**: `src/lib/enforcement.functions.ts`, `src/lib/enforcement.server.ts`
- **Muokataan**: `src/routes/_authenticated.tsx` (polleri + toastit), `src/routes/_authenticated.thermostats.$id.tsx` (huonetemppo, laskuri, refetch), `src/lib/data.functions.ts` (override_started_at-asetus updateThermostatissa), `src/routes/_authenticated.zones.tsx` (tekstit)
- **Ei migraatiota**: olemassa olevat sarakkeet (`override_started_at`, `max_hold_started_at`) ja DB-funktiot pysyvät — DB-funktiota `enforce_pending_overrides` ei kutsuta, mutta jätetään paikoilleen myöhempää pg_cron-vaihtoehtoa varten.

## Jatkokehitys (ei tämän PR:n sisällä)

Tuotannossa polleri vaatii että joku käyttäjä on selain auki. Oikea ratkaisu olisi `pg_cron` joka kutsuu `/api/public/enforce-limits` -reittiä joka minuutti. Voidaan lisätä myöhemmin samalla server fn -koodilla.
