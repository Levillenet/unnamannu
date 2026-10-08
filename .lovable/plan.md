# Lämmitys päällä / pois -graafi termostaateille

## Tausta

Ebeco-rajapinta palauttaa jokaiselle termostaatille kentän `relayOn` (true/false), joka kertoo, syöttääkö termostaatti juuri nyt virtaa lattialämmitykseen — eli "lämmittää / ei lämmitä". Lisäksi rajapinnassa on `todaysOnMinutes` (kuluneen päivän lämmitysminuutit). Näitä ei vielä tallenneta mihinkään, joten historiaa ei voida näyttää.

Koska tuntisynkronointi ottaa tilan talteen kerran tunnissa, graafin tarkkuus on tuntitasolla: jokainen tuntipiste kertoo, oliko rele päällä sillä hetkellä. Tehoa (wattia) ei tarvita — pelkkä päällä/pois riittää.

## Toteutus

### 1. Tallennus
- Lisätään `thermostat_readings`-tauluun sarake `heating boolean` (null = ei tietoa).
- `ebeco-sync.server.ts`: tuntisynkronointi lukee `relayOn`-kentän ja tallentaa sen `heating`-sarakkeeseen jokaisen lukeman yhteydessä. Ei muutosta synkronoinnin tiheyteen (pysyy kerran tunnissa).

### 2. Termostaatin sivu (`/thermostats/$id`)
- Uusi graafi "Lämmitys päällä": aikasarja viimeisimmiltä tunneilta, jossa pylväs/alue on ylhäällä kun `heating = true` ja alhaalla kun false.
- Aikavalitsin: 2 h / 4 h / 24 h (oletus 4 h).
- Graafin yhteyteen yhteenveto: "Lämmittänyt X min viimeisen 4 h aikana" (laskettuna päällä-pisteiden määrästä × tuntiväli).

### 3. Huoneistosivu (valinnainen, kevyt)
- Termostaattikorttiin pieni tunniste "Lämmittää nyt", kun viimeisin lukema on päällä — näkee yhdellä silmäyksellä, mitkä huoneet lämmittävät.

## Tekniset yksityiskohdat

- Migraatio: `alter table thermostat_readings add column heating boolean;` (taulu on append-only, ei RLS-muutoksia — olemassa olevat SELECT/INSERT-politiikat kattavat).
- `ebeco.server.ts`: `relayOn` on jo tyypitetty `EbecoDevice`-tyyppiin; lisätään `pickHeating(d): boolean | null`.
- `ebeco-sync.server.ts`: readings-inserttiin `heating: pickHeating(d)`.
- Graafi: Recharts (jo käytössä) — step-after -viiva tai palkit 0/1-arvoilla; sama tyyli kuin lämpötilagraafeissa.
- Historia alkaa kertyä vasta ensimmäisestä synkronoinnista muutoksen jälkeen — vanhoista tunneista ei ole päällä/pois-tietoa.

## Huomio

- Tarkkuus on tuntitaso, koska synkronointi on kerran tunnissa. Lattialämmitys reagoi hitaasti, joten tuntitaso riittää hyvin arvioimaan lämmitysosuutta. Tiheämpää väliä ei suositella (kasvattaisi palvelinkuluja).
