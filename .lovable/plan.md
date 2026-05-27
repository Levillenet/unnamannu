## Tavoite

Järjestelmän idea on, että asetukset tehdään **sovelluksessa** ja termostaatilta käyttöä rajoitetaan. Tällä hetkellä:
- Asiakkaan yläraja on vain "pehmeä" raja (palauttaa arvon jälkikäteen) – ei estä termostaatista.
- Näyttöasetus, kieli, aikamuoto eivät päivity termostaatille.
- Aikamuodon nykyinen arvo ei näy UI:ssa.

## Juurisyy (asetusten päivittymättömyys)

Ebecon `UpdateUserDevice` (ABP-tyylinen REST) odottaa **koko laitteen DTO:n**, ei pelkkää delta-objektia. Tällä hetkellä lähetämme `{ id, displayWhenIdle: "off" }` → Ebeco hyväksyy kutsun mutta tiputtaa kentät, joita ei ole annettu, ja palauttaa muuttumattoman tilan. Siksi termostaatin näytöllä ei tapahdu mitään.

## Muutokset

### 1. `src/lib/ebeco.server.ts` – lähetä aina täysi DTO
`updateDevice`: ennen PUT-kutsua hae laitteen nykyinen tila Ebecosta (`fetchDeviceById`, varakeino `fetchDevices`-listasta), yhdistä siihen annetut patch-kentät ja lähetä koko objekti `UpdateUserDevice`-kutsuun. Pidä `EBECO_PATCH_FIELDS`-whitelist sallittujen kenttien suodattimena, mutta lähetä lisäksi muut tunnetut nykyarvot mukana (mm. `displayName`, `temperatureSet`, `minSetpoint`, `maxSetpoint`, `sensor*`, lokit jne.). Jos nykytilaa ei saada haettua, kirjaa varoitus ja yritä silti vanhalla tavalla – ettei mikään mene rikki.

### 2. Aina laiteraja päälle – ei enää valintaa
`src/lib/data.functions.ts` `updateThermostat`:
- Poista `sync_guest_max_to_device` -käsittely.
- Aina kun `guest_max_setpoint` muuttuu, lähetä Ebecolle `maxSetpoint = guest_max_setpoint` ja tallenna `max_setpoint`-sarakkeeseen sama arvo.

`src/routes/_authenticated.thermostats.$id.tsx`:
- Poista "Aseta myös termostaatin laiterajaksi" -kytkin ja siihen liittyvä `syncMaxToDevice`-tila.
- Korvaa selittävä teksti: "Tämä arvo asetetaan suoraan termostaatin laiterajaksi – asiakas ei pysty ylittämään sitä termostaatista, Ebeco-sovelluksesta eikä tästä sovelluksesta."
- Säilytä alarivin "Laiteraja Ebecosta: min – max" info.

### 3. Aikamuoto näkyviin
`src/lib/ebeco-settings-meta.ts`:
- Pidä `timeFormat` ilman `column`-kenttää (luetaan `ebeco_settings`-snapshotista). Korjautuu kun synkronointi (#1) lähettää oikean DTO:n ja kun "Synkronoi Ebecosta" tuo tuoreen snapshotin.
- Vaihda `dateFormat`-arvot vastaamaan myös, jos kenttä lisätään tulevaisuudessa.

### 4. Pieni dokumentointi UI:ssa
Lisää "Lukko (estä asiakkaan säätö kokonaan)" -switchin alle pieni teksti: "Suositus: pidä päällä lyhytaikaisvuokrauksessa, jolloin termostaatin nuppi ei toimi."

## Mitä EI tehdä tässä vaiheessa
- Lapsilukon (`childLock`) pakottamista päälle automaattisesti – jätetään ylläpitäjän hallintaan, koska eri kohteissa voi olla eri käytäntö.
- Migraatioita tietokantaan – kaikki tarvittavat sarakkeet ovat jo olemassa.

## Lopputulos
- Asiakkaan ylärajaa muutettaessa raja menee aina suoraan termostaatille → asiakas ei pysty ylittämään sitä millään keinolla.
- Näyttö, kieli, aikamuoto ja muut Ebeco-asetukset päivittyvät oikeasti termostaatille, koska lähetämme täyden DTO:n.
- Aikamuodon nykyinen arvo näkyy UI:ssa heti synkronoinnin jälkeen.
