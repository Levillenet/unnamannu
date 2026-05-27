## Toteutus

Lisätään diagnostiikkaan kaksi uutta toimintoa, joiden avulla löydetään oikea GET-endpoint (joka palauttaa `childLock`) ja tehdään yksi kontrolloitu PUT fyysistä verifiointia varten.

### 1. `src/lib/ebeco-diagnose.server.ts`

Lisätään kaksi uutta vientifunktiota nykyisen `runChildLockDiagnostics`-funktion rinnalle:

**`probeGetEndpoints(id)`** — kokeilee sarjan single-device GET-polkuja:
- `Devices/GetUserDeviceById?Id=`
- `Devices/Get?Id=`
- `Devices/GetDeviceSettings?Id=`
- `Devices/GetUserDeviceFull?Id=`
- `Devices/GetDevice?Id=`
- `UserDevices/Get?Id=`
- `UserDevices/GetById?Id=`

Jokaisesta palauttaa: `path`, `status`, `keyCount`, `containsChildLock` (boolean), `lockKeys` (kentät joiden nimessä lock/pin/child), `childLockValue`, ja max 60 ensimmäistä avainta. Lokitetaan myös `[ebeco-probe]`-prefixillä.

**`singleChildLockPut(id, enable)`** — yksi `PUT /services/app/Devices/UpdateUserDevice` jossa koko nykyinen DTO + `childLock: enable`. Palauttaa `{ status, bodyPreview }` ja kirjaa lokiin. Ei verifiointia — käyttäjä katsoo fyysisesti.

### 2. `src/lib/ebeco-diagnose.functions.ts`

Viedään kaksi uutta server fn:ää: `probeEbecoGetEndpoints` ja `singleChildLockPutFn`.

### 3. `src/routes/_authenticated.settings.tsx` — `EbecoDiagnosticsCard`

Kortin yläosaan kaksi uutta osiota olemassa olevan "Yritä lukita/avata" -lohkon eteen:

**A) GET-probe**: nappi "Etsi GET joka palauttaa childLock". Tulostaulukko: polku, status, sisältääkö childLock-kentän (✓/✗), lock-kentät, avainmäärä, esimerkkiavaimet.

**B) Fyysinen testi**: kaksi nappia "PUT childLock=true (verifioi fyysisesti)" ja "PUT childLock=false". Näyttää statuksen ja vastauksen, ja muistuttaa selkeästi tarkistamaan termostaatin näytön.

Olemassa oleva "9 yritystä" -ajo jää alas talteen.

### Mitä EI tehdä

- Ei kytketä mitään tuotantokoodiin (saveZoneDefault, updateThermostatSettings) ennen kuin fyysinen verifiointi vahvistaa toimivan PUT:n.
- Ei muokata `ebeco.server.ts` -tuotantopolkua tässä iteraatiossa.

### Lopputulos

Yhden sivulatauksen aikana näet a) löytyykö GET joka kertoo todellisen `childLock`-tilan, ja b) menikö yksi puhdas PUT läpi (ja tarkistat fyysisesti). Näiden tuloksien perusteella seuraavassa iteraatiossa kytken oikean polun tuotantoon.