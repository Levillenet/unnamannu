# Näytetään lämpötilat oikealta anturilta

## Mitä Ebeco lähettää (tarkistettu)

Ebeco lähettää jokaiselta termostaatilta aina sekä huone- että lattialukeman, vaikka lattia-anturia ei olisi kytketty. Anturityyppi kerrotaan erikseen ("sensorApplication"):

| Termostaatti | Anturityyppi | Huone | Lattia |
|---|---|---|---|
| Testitermostaatti | Room | 21,7 | 20 (ei anturia — merkityksetön arvo) |
| As14oh1 | Room + limiting floor | 23,1 (ohjaava) | 24 (rajoittava) |
| As14ph | Floor | 22,2 (sisäinen) | 23,6 (ohjaava) |

Nyt sovellus näyttää molemmat arvot kaikille, joten Testitermostaatin "lattia 20 °C" on harhaanjohtava.

## Muutos

Lämpötilat näytetään anturityypin mukaan kaikissa näkymissä (huoneistokortit, termostaattisivu, laitteet, lämpötilamittaukset):

- **Room** → vain huonelämpö. Lattia: "ei anturia".
- **Floor** → lattialämpö ohjaavana, huonelämpö pienellä "sisäinen anturi".
- **Room + limiting floor** → huonelämpö ohjaavana, lattialämpö "rajoittava".
- **Floor + limiting room** → lattia ohjaavana, huone "rajoittava".
- Tuntematon tyyppi → molemmat kuten nyt.

Lisäksi termostaattikorttiin tulee pieni merkintä anturityypistä (esim. "Huoneanturi"), ja tallennetaan historiaan lattialukema vain, kun lattia-anturi on käytössä, jotta kaaviot eivät näytä olemattomia arvoja.

## Tekniset yksityiskohdat

- Uusi apuri `src/lib/sensor.ts`: `sensorMode(sensor_application)` → `{ primary: "room"|"floor", showRoom, showFloor, roomLabel, floorLabel }`.
- `ebeco-sync.server.ts` / `pickFloorTemp`: palauttaa `null`, jos tyyppi on "Room".
- Näkymät (`apartments.$id`, `apartments`, `thermostats.$id`, `devices`, `dashboard`) käyttävät apuria.
- Vanhoja historiarivejä ei muuteta; näyttö piilottaa lattiasarjan Room-termostaateilta.
