# Anturiasetuksen muutokset historiaan

## Tilanne nyt
Ebecon viimeisin tieto (klo 12.04): 54 termostaattia "Room + limiting floor", 28 "Floor", 1 "Room" (Testitermostaatti), 1 "Floor + limiting room" (AsA14Wc1). Muutoksesi näkyy siis toistaiseksi vain AsA14Wc1:ssä. Jos muutit muita, ne näkyvät seuraavassa päivityksessä tai "Päivitä nyt" -painikkeella.

## Muutos
- Sovellus tallentaa joka kerta, kun termostaatin anturiasetus muuttuu Ebecossa: aika, vanha ja uusi asetus.
- Termostaatin sivulle "Anturiasetuksen historia" (esim. "11.11. klo 12.15: Floor → Floor + limiting room").
- Laitteet-sivulle näkyviin kunkin termostaatin nykyinen anturiasetus, jotta näet kerralla, mitkä on jo vaihdettu.
- Lämpötilagraafissa ohjaava lukema vaihtuu automaattisesti uuden asetuksen mukaan.

## Tekniset yksityiskohdat
- Uusi taulu `thermostat_sensor_events` (thermostat_id, ts, old_app, new_app) + GRANT/RLS (admin/authenticated luku).
- Trigger `thermostats`-taululle: kun `ebeco_settings->>'sensorApplication'` muuttuu, lisätään rivi (sama malli kuin yhteyshistoriassa).
- `getThermostat` palauttaa `sensorEvents` (90 pv); `thermostats.$id.tsx` uusi kortti; `devices.tsx` anturisarake `sensorMode().label`.
