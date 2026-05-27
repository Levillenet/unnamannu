## Vastaukset kysymyksiisi

**Onko rajapinnassa lukitus?** Kyllä. Termostaatti-taulussa on jo `locked`-kenttä (boolean), jota käytetään jo yksittäisen termostaatin näkymässä ("Lukko – estä asiakkaan säätö kokonaan"). Ebeco-rajapinta tukee samaa: laite pidetään kiinteässä asetusarvossa eikä asiakas pääse säätämään näytöltä. Tässä mallinnamme sen `locked = true` -tilana.

**Yksittäisen ylärajan nosto vs. vyöhykepäivitys:** Kyllä, kun "Sovella ylärajaa kaikkiin" painetaan, se ylikirjoittaa kaikkien vyöhykkeen termostaattien `guest_max_setpoint`-arvon. Yksittäisen termostaatin korotus on siis kertaluonteinen. Tämä on jo nykyinen toimintatapa — selvennetään se vain UI:ssa.

**Miten termostaatti kuuluu vyöhykkeeseen?** Jokaisella termostaatilla on `zone`-kenttä (`room` tai `bathroom`). Tällä hetkellä se asetetaan vain seedissä. Lisätään termostaatin asetuksiin pudotusvalikko, josta vyöhykkeen voi vaihtaa.

## Mitä rakennetaan

### 1. Vyöhykeasetuksiin (`/zones`) uudet toiminnot

Jokainen vyöhykekortti (Huoneet / Kylpyhuoneet) saa:
- **Lukko-kytkin**: "Lukitse kaikki vyöhykkeen termostaatit" — kun päällä, kaikki vyöhykkeen termostaatit menevät `locked = true` -tilaan (asiakas ei pääse säätämään).
- **Pakota asetusarvo kaikkiin**: numerokenttä + painike "Aseta kaikkiin (esim. 18 °C)". Kirjoittaa `current_setpoint`-arvon koko vyöhykkeelle. Hyödyllinen esim. tyhjien huoneiden energiansäästöön.
- Säilytetään olemassa olevat "Tallenna oletukset" ja "Sovella ylärajaa kaikkiin".

UI lisää myös selittävän rivin: *"Yksittäiselle termostaatille tehdyt ylärajan muutokset ylikirjoittuvat, jos vyöhykkeen yläraja sovelletaan uudelleen kaikkiin."*

### 2. Termostaatin asetussivulle vyöhykkeen valinta

Termostaattikorttiin (`/thermostats/$id`) lisätään uusi rivi:
- **Vyöhyke**: pudotusvalikko (Huone / Kylpyhuone). Muuttaa `thermostats.zone`-kenttää.
- Vaihdon jälkeen termostaatti seuraa uuden vyöhykkeen oletuksia seuraavalla "sovella kaikkiin" -toiminnolla.

### 3. Palvelinfunktiot

- `updateThermostat`: lisää `zone`-kentän hyväksyttyihin syötteisiin.
- `saveZoneDefault`: lisää valinnaiset parametrit
  - `lockAll: boolean` → päivittää `locked = true/false` kaikille vyöhykkeen termostaateille
  - `applySetpointToAll: number` → asettaa kaikkien `current_setpoint`-arvon annettuun
  - Säilytetään olemassa oleva `applyToAll` ylärajalle.

### Tekninen tiivistys

- Tietokantamuutoksia ei tarvita — `locked`, `zone`, `current_setpoint` ovat jo olemassa.
- `enforce_guest_max`-trigger huolehtii edelleen siitä, että asetusarvo ei ylitä ylärajaa.
- Termostaatin korotus toimii edelleen vain niin pitkään kuin uusi vyöhykepäivitys ei ylikirjoita sitä — sama tallennusmekaniikka kuin nyt.
