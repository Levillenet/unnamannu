# Synkronoi nyt -nappi huoneistosivulle

## Mitä tulee
- Huoneistosivun otsikon viereen nappi **"Synkronoi nyt"**.
- Painettaessa:
  1. Haetaan Ebecosta heti ajantasaiset tiedot (asetukset, mitatut huone- ja lattialämmöt, online-tila).
  2. Ajetaan heti lämpörajojen tarkistus (yli asiakasmaksimin -> leikataan, palautusajastimet).
  3. Sivun termostaattikortit päivittyvät heti uusilla arvoilla.
- Napin aikana pyörivä kuvake ja teksti "Synkronoidaan…", lopuksi ilmoitus "Synkronoitu" tai selkeä virheviesti.
- Napin alla pieni teksti: "Viimeksi synkronoitu: klo HH:MM".

## Tekniset tiedot
- Käytetään olemassa olevia `syncEbecoDevices` (data.functions.ts) ja `enforceThermostatLimits` (enforcement.functions.ts) -toimintoja peräkkäin; ei uusia tietokantamuutoksia.
- `src/routes/_authenticated.apartments.$id.tsx`: `useMutation` + `useServerFn`, onSuccess invalidoi `["apartment", id]`, `["devices"]`, `["dashboard"]`-kyselyt.
- Yksi Ebeco-haku hakee kaikki laitteet kerralla, joten kulutus on yhden tavallisen tuntiajon verran.
