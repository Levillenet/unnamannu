# Vyöhykkeen oletuslämpötila termostaatteihin

## Syy
Kun vyöhykkeen asetukset tallennetaan "termostaatteihin", vain asiakkaan yläraja kopioidaan termostaateille. Oletuslämpötilaa (24 °C) ei kirjoiteta termostaattien asetukseksi eikä lähetetä Ebecoon. Siksi kylpyhuoneissa As14ph ja As15ph asetus on yhä 20 °C (As12ph oli jo valmiiksi 24).

## Korjaus
1. Vyöhykkeen tallennus "termostaatteihin" asettaa jokaisen vyöhykkeen termostaatin asetuslämpötilaksi uuden oletuksen (rajattuna asiakkaan ylärajaan ja laiterajaan).
2. Uusi asetus ja asiakasmaksimi lähetetään heti Ebecoon (sama mekanismi kuin "Synkronoi nyt"), jotta muutos näkyy laitteissa eikä odota tuntia.
3. Ilmoitus kertoo montako termostaattia päivitettiin ja montako epäonnistui (esim. offline).
4. Korjataan nykyiset kylpyhuoneet: tallennuksen jälkeen ajetaan kerran, jolloin As14ph ja As15ph saavat 24 °C.

## Tekninen
- `saveZoneDefault` (`src/lib/data.functions.ts`): kun `applyToAll`, päivitä `current_setpoint = min(default_setpoint, guest_max_setpoint)` ja `guest_max_setpoint`; kutsu `pushPatchToTargets(ids, { temperatureSet, maxSetpoint })`; palauta pushed/failed.
- `zones.tsx`: toast näyttää tuloksen ja invalidoi huoneisto-/laitekyselyt.
