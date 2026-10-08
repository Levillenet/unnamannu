# Lämmittää / ei lämmitä -tunniste selkeällä sanamuodolla

## Tausta

Lämmitystilaa (`relayOn` Ebeco-rajapinnasta) näkyy jo huoneiston omalla sivulla, mutta vain kun lämmitys on päällä ("Lämmittää"). Kun lämmitys on pois päällä, mitään ei näy — käyttäjä ei voi tietää, onko tila luettu vai puuttuuko tieto kokonaan. Huoneet-listan laajennetuilla riveillä tunnistetta ei ole lainkaan.

Käyttäjä haluaa selkeän kahtiajaon: lämmittää juuri nyt / ei lämmitä juuri nyt.

## Toteutus

Tieto on jo saatavilla suoraan listauksen mukana (`ebeco_settings.relayOn`), joten muutos on pelkästään käyttöliittymää.

### 1. Huoneet-listan laajennetut rivit (`_authenticated.apartments.tsx`)
Termostaattirivin tilamerkkien (Online/Offline/Hälytys) yhteyteen tila tunniste:
- `relayOn === true` → keltainen lämmöntunniste (liekki-kuvake): **"Lämmittää nyt"**
- `relayOn === false` → harmas/neutraali tunniste: **"Ei lämmitä nyt"**
- `relayOn` ei tiedossa (laite ei ole lähettänyt tilaa) → ei tunnistetta, jotta puuttuva tieto ei näytä harhaanjohtavalta

### 2. Huoneiston sivu (`_authenticated.apartments.$id.tsx`) — sama sanamuoto
- Nykyinen "Lämmittää" -tunniste muutetaan samaan kahtiajakoon: **"Lämmittää nyt"** / **"Ei lämmitä nyt"** (nykyinen "Lämmittää"-vain-päällä-logiikka korvataan molemmin puolin näyttävällä).

## Tekniset yksityiskohdat

- Ei migraatiota, ei taustamuutoksia: `relayOn` on jo talletettu `ebeco_settings`-kenttään ja tulee listApartments/getApartment-mukana.
- Tunnisteet käyttävät olemassa olevia semanttisia tokeneita (warning-pehmeä tausta lämmölle, muted ei-lämmitykselle).
- Tieto päivittyy 15 minuutin synkronointisyklillä (tai "Synkronoi nyt" -napilla).
