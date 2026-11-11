# Kirjautumisen hitauden korjaus

## Havainto
Kirjautumislokin mukaan salasana hyväksytään joka kerta (klo 11.43 viisi onnistunutta kirjautumista peräkkäin). Ongelma on siis se, että kirjautumisen jälkeen etusivulle siirtyminen jää jumiin ja kirjautumislomake näkyy edelleen. Siksi nappia on painettu monta kertaa.

## Korjaukset
1. **Kirjautumisnappi näyttää heti "Kirjaudutaan…"** siihen asti kunnes etusivu on auki, eikä sitä voi painaa uudelleen.
2. **Etusivu avautuu heti** ja luvut täyttyvät taustalla (latausmerkki korteissa). Nyt sivu odottaa kaikkien termostaattien ja ylitysten hakua ennen näyttämistä, ja se on hidasta 84 termostaatilla.
3. **Turhat uudelleenlataukset pois:** sovellus lataa nyt kaiken uudelleen myös joka kerta kun kirjautuminen virkistyy taustalla (esim. kun puhelimen välilehteen palataan). Rajataan vain sisään- ja uloskirjautumiseen.
4. **Etusivun haun nopeutus:** mitataan, mikä kysely on hitain, ja kevennetään se (esim. ylityslaskenta ja offline-lista).

## Tarkistus
Kirjaudutaan testikäyttäjänä, mitataan aika napin painalluksesta etusivun näkymiseen ennen ja jälkeen.

## Tekninen
- `login.tsx`: loading pysyy päällä onnistuneen signIn:n jälkeen; navigate kerran.
- `__root.tsx` AuthSync: suodata SIGNED_IN/SIGNED_OUT/USER_UPDATED; ei invalidateQueries SIGNED_OUT:ssa.
- `_authenticated.dashboard.tsx`: loader ei odota (ei await/ensure blokkaavana) tai `pendingComponent`; Suspense-rajat kortteihin.
- `getBuildingOverview`: profiloi ja kevennä.
