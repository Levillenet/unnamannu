# Offline-termostaatit: mitä tapahtui ja seuranta jatkossa

## Mitä tiedot näyttävät
- Tänään klo 8.30–8.45 (Suomen aikaa) 70 termostaattia 84:stä putosi offline-tilaan samaan aikaan. Klo 9.45 mennessä 2 oli palannut itsestään, joten nyt 68 on offline ja 16 online.
- Ebeco antaa kaikille saman syyn: "Device is offline. Make sure the device is connected to a wifi". Laite ei saa yhteyttä Ebecon palveluun. Vika ei ole sovelluksessamme.
- Laitteet ovat samassa WiFi-verkossa, ja osa pysyi koko ajan yhteydessä eri taloissa (A1, A3, A9, A10, A14, B1, B2, B3). Koko verkko ei siis kaatunut.

## Todennäköiset syyt (en voi varmistaa niitä täältä)
1. Osa tukiasemista katkesi tai käynnistyi uudelleen klo 8.30–8.45. Silloin yhteydessä pysyneet laitteet ovat toimivien tukiasemien alla. Kysy verkon ylläpitäjältä, mitkä tukiasemat olivat tuolloin poissa käytöstä.
2. Verkosta loppuivat vapaat osoitteet, tai reititin tai palomuuri esti yhteyden Ebecon palveluun.
3. Ebecon palvelussa oli osittainen häiriö. Katso Ebecon omasta sovelluksesta, näkyvätkö samat laitteet offline sielläkin.
4. Sähkökatko on epätodennäköisempi syy, koska laitteet putosivat täsmälleen samaan aikaan eri taloissa.

Sovellus ei tallenna aiempien katkojen putoamisaikoja. Tämänpäiväinen aika näkyy vain siksi, että kaikki laitteet putosivat yhtä aikaa.

## Ehdotettu parannus
1. Sovellus tallentaa kellonajan aina, kun termostaatti katkeaa tai palaa yhteyteen.
2. Termostaatin sivulle tulee "Yhteyshistoria": milloin laite katkesi, milloin se palasi ja kuinka kauan katko kesti.
3. Etusivulle tulee huomautus "X termostaattia offline", jossa näkyy katkon alkamisaika. Jos monta laitetta katkeaa yhtä aikaa, sovellus kertoo todennäköisestä verkkokatkosta.

## Tekninen osa
- Uusi taulu `thermostat_status_events` (thermostat_id, status, ts, error_message), GRANT + RLS kuten readings.
- `syncEbecoIntoSupabase` vertaa vanhaa ja uutta statusta ja lisää rivin, kun tila muuttuu.
- `getBuildingOverview` palauttaa offline-listan ja katkon alkamisajat. Termostaattisivulle tulee lista viimeisen 30 päivän tapahtumista.
