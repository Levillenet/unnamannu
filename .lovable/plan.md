## Ongelma

Oikealla laitteella `syncEbecoDevice` heittää "Ebecosta ei saatu vastausta tälle laitteelle", koska `fetchDeviceById` palauttaa `null`. Syy: `/services/app/Devices/GetUserDevice?Id={id}` -kutsu joko epäonnistuu (404 / eri polku) tai palauttaa eri muotoisen vastauksen kuin `{ result: {...} }`. Virhe nielaistaan `try/catch` -lohkossa ja UI näkee vain geneerisen viestin → tyhjä ruutu.

## Muutokset

### 1. `src/lib/ebeco.server.ts` – `fetchDeviceById`
- Hyväksy useampi vastausmuoto: `json.result`, suora `json`-objekti (`{ id, ... }`), tai `json.result.items[0]`.
- Älä piilota virhettä – kirjaa `console.error` HTTP-statuksella ja vastauksen alulla, jotta saadaan oikea syy talteen.

### 2. `src/lib/data.functions.ts` – `syncEbecoDevice`
- Tee **varakeino**: jos `fetchDeviceById` palauttaa `null`, hae `fetchDevices()` (lista, jonka tiedämme toimivan), etsi sieltä `d.id === Number(row.ebeco_device_id)` ja käytä sitä. Tämä takaa että synkronointi toimii vaikka yksittäisen laitteen endpoint olisi rikki.
- Jos kumpikaan ei tuota tulosta, palauta `{ ok: false, message: "..." }` virheen heittämisen sijaan.
- Onnistuessa palauta `{ ok: true, message: "Synkronoitu Ebecosta" }`.

### 3. `src/routes/_authenticated.thermostats.$id.tsx` – `SyncDeviceButton`
- Lue `ok`/`message` vastauksesta ja näytä `toast.success`/`toast.error` sen mukaan – ei enää `throw` → blank screen.
- Kirjoita `onError`-haaraan myös `toast.error(err.message)` viimeisenä varmistuksena.

## Lopputulos

- Oikealla laitteella synkronointi toimii listauksesta saaduilla tiedoilla, vaikka per-device endpoint epäonnistuisi.
- Käyttäjä näkee aina selkeän toastin, ei tyhjää ruutua.
- Lokeihin jää tarkka virheviesti tulevaa debuggausta varten.
