# Vyöhykkeen tallennus: miksi 7/11 epäonnistui ja korjaus

## Mitä tietokanta näyttää nyt
- Eteinen-vyöhykkeellä on oikeasti 11 termostaattia (AsA3Et, AsA5Et, AsA10Et, AsA11Et, AsA14Et, AsA15Et, AsB1Et, AsB2Et, AsC1Aula, AsC3Aula, AsC4Aula). Kaikki ovat online ja synkronoitu klo 21.42. Vyöhykkeitä ei tarvitse synkronoida erikseen — määrä 11 on oikein.
- Järjestelmässä on yhteensä 53 termostaattia, joista 1 on vielä allokoimatta. Jos uusia lisättyjä eteisiä puuttuu, ne on allokoitu toiseen vyöhykkeeseen tai niitä ei vielä ole Ebeco-tilillä.
- Oletus 19 °C on tallennettu kaikille 11:lle sovelluksessa, mutta Ebecoon meni perille vain 4. Ilmoituksen "esim. offline" on harhaanjohtava: laitteet eivät olleet offline.

## Todennäköinen syy (varmistetaan ensin)
Sovellus lähettää kaikki 11 muutosta Ebecoon yhtä aikaa. Ebeco todennäköisesti torjuu osan liian tiheistä pyynnöistä. Virheen tarkkaa syytä ei nyt tallenneta mihinkään, joten se varmistetaan ensimmäisenä.

## Korjaus
1. Tallennetaan Ebecon palauttama virheviesti jokaisesta epäonnistuneesta termostaatista lokiin, jotta syy näkyy.
2. Lähetetään muutokset Ebecoon peräkkäin pienellä tauolla (ei kaikkia kerralla), ja epäonnistunut yritetään automaattisesti uudelleen 1–2 kertaa.
3. Ilmoitus kertoo epäonnistuneiden termostaattien nimet ja oikean syyn "offline"-arvauksen sijaan.
4. Testataan tallentamalla Eteinen 19 °C uudelleen ja tarkistetaan, että kaikki 11 näyttävät 19 °C myös Ebecossa.

## Tekninen osa
- `pushPatchToTargets` (`src/lib/data.functions.ts`): `Promise.allSettled` → peräkkäinen silmukka ~300 ms viiveellä, 2 uusintayritystä takaisinvedolla; palauttaa `failedNames` + `errors`; `console.error` jokaisesta virheestä.
- `saveZoneDefault`, `setZonePower`, `syncApartmentNow` hyötyvät samasta funktiosta; audit_log-detailsiin lisätään `errors`.
- `zones.tsx`-toast näyttää `failedNames` ja ensimmäisen virheviestin.
