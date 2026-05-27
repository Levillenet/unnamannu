## Tavoite

Saada `childLock` toimimaan termostaatille 94922 saman tavoin kuin Ebecon omassa sovelluksessa. Koska virallinen `UpdateUserDevice` ei näytä hyväksyvän kenttää, oletamme että Ebecon sovellus käyttää joko eri endpointia tai eri payload-muotoa. Selvitetään se järjestelmällisesti ja kytketään löydetty tapa tuotantokoodiin.

## Vaihe 1 — Diagnostiikkaserveri-funktio (`src/lib/ebeco-diagnose.functions.ts`)

Uusi suojattu serverFn `diagnoseEbecoChildLock({ id, enable })`, jota voi ajaa Asetukset-sivulta napilla. Funktio:

1. Hakee tuoreen tokenin ja nykyisen DTO:n (`fetchDeviceById`).
2. Lokittaa kaikki kentät joiden nimessä on `lock`, `pin`, `child` tai `keylock` — näemme palauttaako `GetUserDevices` ko. kenttiä ylipäätään.
3. Yrittää sarjassa useita kandidaatteja ja kirjaa jokaisesta `status` + `response.body` (max 400 merkkiä):
   - `PUT /services/app/Devices/UpdateUserDevice` koko DTO + `childLock: enable`
   - `PUT /services/app/Devices/UpdateUserDevice` koko DTO + `keyLock: enable` (vaihtoehtoinen nimi)
   - `POST /services/app/Devices/SetChildLock` `{ id, value: enable }`
   - `POST /services/app/Devices/SetDeviceChildLock` `{ id, childLock: enable }`
   - `POST /services/app/Devices/UpdateDeviceSettings` `{ id, childLock: enable }`
   - `PUT /services/app/Devices/UpdateUserDeviceSettings` koko DTO + `childLock: enable`
   - `POST /services/app/UserDevices/SetChildLock` `{ id, value: enable }`
4. Jokaisen kutsun jälkeen pieni `GET GetUserDevices` ja vertaa palasiko `childLock`/`keyLock` muuttuneena → tämä on lopullinen totuus.
5. Palauttaa UI:lle taulukon `{ path, method, status, bodyPreview, childLockAfter }`.

Tämä on read-mostly diagnostiikkaa: tunnistamme oikean polun yhdellä ajolla ilman arvauksia.

## Vaihe 2 — Diagnostiikkanäkymä Asetukset-sivulle

`src/routes/_authenticated.settings.tsx`: pieni "Ebeco-diagnostiikka" -kortti (admin-only) jossa:
- input thermostat ID:lle (oletus 94922)
- napit "Yritä lukita" ja "Yritä avata"
- tulostaulukko vastaukista

Tulokset näkyvät myös serverilokeissa joista voin lukea ne.

## Vaihe 3 — Kytketään löytynyt polku tuotantoon

Kun Vaihe 1 paljastaa toimivan endpointin:

- `src/lib/ebeco.server.ts`: lisätään `setChildLock(id, value)` -funktio joka käyttää oikeaa polkua/payloadia. Cachetetaan toimiva tapa moduuliskooppiin samaan tyyliin kuin `workingSinglePath`.
- `src/lib/data.functions.ts`: 
  - `saveZoneDefault` (lukitse-koko-vyöhyke) → kutsuu `setChildLock` jokaiselle numeerisen ID:n omaavalle termostaatille.
  - `updateThermostatSettings` ja `broadcast`-polut → kun patchissa on `childLock`, käytetään `setChildLock` `updateDevice`-kutsun sijaan/lisäksi.
- Demolaitteet (ei-numeerinen ID) pysyvät visuaalisina kuten nyt.

## Vaihe 4 — UI-palaute

- `ZoneCard` ja yksittäinen lapsilukko-switch näyttävät toast-virheen jos Ebeco palauttaa ei-200:n; onnistumisen jälkeen invalidoidaan `devices`/`thermostat`-queryt jotta tuore tila virtaa UI:hin.
- Poistetaan nykyiset "ei mene laitteelle" -varoitukset lapsilukosta, koska se alkaa toimia oikeasti.

## Mitä EI tehdä

- Ei kosketa muihin Ebeco-asetuksiin (näyttö, kieli yms.) tässä iteraatiossa — keskitytään lapsilukkoon.
- Ei muuteta `syncEbecoDevices`-logiikkaa.
- Ei tehdä mitään mainnetia kunnes Vaihe 1 vahvistaa toimivan endpointin lokeista.

## Lopputulos

Yksi diagnostiikka-ajo riittää löytämään Ebecon todellisen lapsilukko-rajapinnan. Sen jälkeen kytkennät vyöhykkeen lukitsemiseen ja yksittäiseen termostaattiin toimivat oikein myös fyysisellä laitteella, eikä käyttäjälle enää valehdella "tallennettiin" jos Ebeco hylkäsi pyynnön.