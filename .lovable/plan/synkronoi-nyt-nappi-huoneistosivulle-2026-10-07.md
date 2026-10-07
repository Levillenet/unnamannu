# Synkronoi nyt -nappi huoneistosivulle

## Mitä tulee
- Huoneistosivun otsikon viereen nappi **"Synkronoi nyt"**.
- Painettaessa (vain tämän huoneiston termostaatit):
  1. **Kirjoitetaan** sovelluksessa asetetut arvot termostaatteihin Ebecoon (asetuslämpötila, asiakasmaksimi laiterajaksi, ohjelma, päälle/pois).
  2. Haetaan Ebecosta heti ajantasaiset tiedot (asetukset, mitatut huone- ja lattialämmöt, online-tila).
  3. Ajetaan lämpörajojen tarkistus (yli asiakasmaksimin -> leikataan, palautusajastimet).
  4. Sivun termostaattikortit päivittyvät heti uusilla arvoilla.
- Jos termostaatti on offline, siitä näytetään ilmoitus eikä muiden synkronointi keskeydy.
- Napin aikana pyörivä kuvake ja teksti "Synkronoidaan…", lopuksi ilmoitus "Synkronoitu" tai selkeä virheviesti.
- Napin alla pieni teksti: "Viimeksi synkronoitu: klo HH:MM".

## Tekniset tiedot
- Uusi `syncApartmentNow({ apartmentId })` -palvelinfunktio (data.functions.ts, requireSupabaseAuth): lukee huoneiston termostaatit, kutsuu olemassa olevaa `pushPatchToTargets`-logiikkaa (temperatureSet, maxSetpoint, selectedProgram, powerOn), sitten `syncEbecoIntoSupabase` ja enforcement-ajo näille riveille. Palauttaa onnistuneet/epäonnistuneet. Ei tietokantamuutoksia.
- `src/routes/_authenticated.apartments.$id.tsx`: `useMutation` + `useServerFn`, onSuccess invalidoi `["apartment", id]`, `["devices"]`, `["dashboard"]`-kyselyt.
- Yksi Ebeco-haku hakee kaikki laitteet kerralla, joten kulutus on yhden tavallisen tuntiajon verran.
