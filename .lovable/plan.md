# Offline-termostaatit: mitä tapahtui ja seuranta jatkossa

## Mitä tiedot näyttävät (tarkistettu nyt)
- 84 termostaatista 70 on offline ja 14 online.
- Kaikki 70 putosivat samaan aikaan: viimeinen onnistunut yhteys oli tänään klo 8.30 (Suomen aikaa). Klo 8.45 päivityksessä ne olivat jo offline.
- Ebecon antama syy jokaiselle on sama: "Device is offline. Make sure the device is connected to a wifi". Laite ei siis saa yhteyttä Ebecon palveluun. Vika ei ole meidän sovelluksessamme.
- Online-laitteita on eri taloissa (A1, A3, A9, A10, A14, B1, B2, B3 ja Testitermostaatti). Siksi kyse ei ole yhden talon vioista.

## Todennäköiset syyt (näitä en voi varmistaa täältä)
1. Kiinteistön verkko tai reititin katkesi klo 8.30–8.45, tai jokin WiFi-tukiasema on alhaalla. Tämä on todennäköisin syy, koska laitteet putosivat yhtä aikaa.
2. Sähkökatko tai lattialämmityksen ryhmäsulake joissain osissa.
3. Ebecon pilvipalvelussa on häiriö. Tarkista Ebecon omasta sovelluksesta: jos laitteet näkyvät sielläkin offline, vika on verkossa tai Ebecolla.

Yksi asia jää vielä epäselväksi. Sovellus ei tallenna aiemmin pudonneiden laitteiden putoamisaikaa. Tämänpäiväinen aika näkyy vain siksi, että kaikki putosivat yhtä aikaa.

## Ehdotettu parannus
1. Jokainen tilan muutos (online ↔ offline) tallennetaan sovellukseen kellonajan kanssa.
2. Termostaatin sivulle tulee kohta "Yhteyshistoria": milloin laite putosi, milloin palasi ja kuinka kauan katko kesti.
3. Etusivulle tulee huomautus "X termostaattia offline", jossa näkyy putoamisaika. Jos monta laitetta putosi samaan aikaan, siitä kerrotaan erikseen ("todennäköisesti verkkokatko").

## Tekninen osa
- Uusi taulu `thermostat_status_events` (thermostat_id, status, ts, error_message), RLS kuten readings.
- `syncEbecoIntoSupabase`: vertaa vanhaa statusta uuteen ja lisää rivin, kun tila muuttuu.
- `getBuildingOverview` palauttaa offline-listan ja putoamisajat. Termostaattisivulle tulee 30 päivän tapahtumalista.
