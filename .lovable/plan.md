
# Ebeco-ohjausjärjestelmä – MVP (UI-prototyyppi mock-datalla)

Rakennetaan isännöitsijän/huoltomiehen hallintapaneeli, joka näyttää miltä lopullinen järjestelmä näyttäisi. Ei vielä oikeaa Ebeco-yhteyttä – kaikki data on mockattua, jotta UX ja tietomalli voidaan validoida ennen integraatiota.

## Rajapinta-tutkimuksen yhteenveto

- **Ebeco Cloud Open API**, base URL `https://ebecoconnect.com/api/`
- REST + JSON, Bearer-auth (yksi palvelutili → yksi token kattaa kaikki 80+ termostaattia)
- Swagger: `https://ebecoconnect.com/swagger/index.html`
- Keskeiset endpointit: `services/app/Devices/GetUserDevices`, laitteen tilan luku/kirjoitus, asetuslämpötila
- **Rate limit: 10 req / 10 s ja 30 req / 60 s per IP** → tämä ratkaisee arkkitehtuurin: backend pollaa keskitetysti ja välimuistittaa, frontti ei koskaan kutsu Ebecoa suoraan
- Tämä versio käyttää mock-dataa, mutta tietomalli ja UI rakennetaan niin että oikea integraatio on suoraviivainen jatkossa

## Mitä MVP sisältää

**Roolit:** isännöitsijä/huoltomies (yksi rooli MVP:ssä, ei asukasnäkymää vielä)

**Sivut:**
1. **Yleisnäkymä (Dashboard)** – kiinteistön tila: hälytykset, offline-termostaatit, keskilämpötila, kokonaiskulutus (24 h / 30 vrk)
2. **Huoneistolista** – 26 huoneistoa taulukkona: huoneisto, termostaattien määrä, keskilämpötila, tila, viimeisin yhteys
3. **Huoneiston näkymä** – yksittäisen huoneiston termostaatit (esim. olohuone, kylpyhuone, makuuhuone): nykyinen huone-/lattialämpötila, asetusarvo, tila, energia
4. **Termostaatin näkymä** – yksittäisen termostaatin täysi hallinta: asetuslämpö (slider), päälle/pois, lukko, valitse aikataulu, 7 vrk lämpötilakäyrä, kulutus
5. **Aikataulut & energiaohjelmat** – luo/muokkaa ohjelmia (yöalennus, lomatila, viikkokalenteri) ja kohdista yhteen tai useampaan termostaattiin/huoneistoon kerralla
6. **Energiaraportit** – pylväs-/viivakaaviot huoneistoittain ja koko kiinteistölle (päivä/viikko/kuukausi)
7. **Asetukset** – käyttäjät, paikka (myöhemmin Ebeco API -kytkentä)

**Kirjautuminen:** Lovable Cloud, sähköposti+salasana ja Google-kirjautuminen. Ei käyttäjäprofiilitaulua vielä (ainoa rooli on isännöitsijä; lisätään profiles-taulu siinä vaiheessa kun asukasrooli tulee).

## Tekniset valinnat

- **Stack:** TanStack Start (jo paikalla) + Tailwind + shadcn/ui + Recharts kaavioihin
- **Backend:** Lovable Cloud (auth + Postgres). Tietomalli rakennetaan oikeaksi heti, mock vain seeder-skriptillä
- **Tietomalli (taulut):**
  - `buildings` (1 rivi MVP:ssä)
  - `apartments` (26 riviä – numero, kerros, asukas-nimi vapaaehtoinen)
  - `thermostats` (80+ riviä – ebeco_device_id, nimi, sijainti huoneistossa, apartment_id)
  - `thermostat_readings` (aikasarja: room_temp, floor_temp, setpoint, power_w, ts)
  - `schedules` (nimi, viikkokalenteri JSON)
  - `schedule_assignments` (kohdistus termostaatti/huoneisto)
- **Mock-data:** seeder-server-fn täyttää 26 huoneistoa, 3 termostaattia per huoneisto keskimäärin, 30 päivän tunnittaiset lukemat realistisilla arvoilla
- **Reitit:** `/`, `/login`, `/_authenticated/` -layout, `/_authenticated/apartments`, `/_authenticated/apartments/$id`, `/_authenticated/thermostats/$id`, `/_authenticated/schedules`, `/_authenticated/energy`, `/_authenticated/settings`

## Mitä MVP EI sisällä (seuraavissa iteraatioissa)

- Oikea kytkentä `ebecoconnect.com` API:in (server functions ja polling-job, rate-limit-aware)
- Asukasrooli ja oman huoneiston näkymä
- Hälytys-sähköpostit/push
- Mobiilisovellus

## Suunnitelma rakentamiseen

1. Lovable Cloud käyttöön + auth (email + Google)
2. Tietokantataulut + RLS + seed-funktio mock-datalle
3. Reittirakenne ja `_authenticated` -layout sivupalkilla
4. Dashboard + huoneistolista + huoneistonäkymä
5. Termostaattinäkymä + lämpö-/energiakaaviot
6. Aikataulut & energiaohjelmat (CRUD + kohdistus)
7. Energiaraportit-sivu
8. Pieni visuaalinen viimeistely ja tyhjien tilojen viestit

Kun MVP on hyväksytty, seuraava vaihe on oikean Ebeco Cloud API:n kytkentä server function -tasolla + taustapolling.
