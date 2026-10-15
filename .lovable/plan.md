# Korjaus: "Lämmittänyt 30 min viim 24 h" -lukeman harhaanjohtavuus

## Mistä luku 30 min tulee

Lämmitysaika lasketaan 15 minuutin välein otetuista tilannekuvista: jokainen mittauspiste, jossa termostaatin rele oli päällä (`heating = true`), lasketaan 15 minuutiksi lämmitystä.

Testitermostaatin (Ebeco 94922) data viimeisen 24 h ajalta:

- Vain **3 mittauspistettä** koko vuorokauden aikana (klo 18.38, 18.42, 18.51)
- Niistä 2 näyttää lämmitys päällä → 2 × 15 min = **30 min**
- Aiemmat mittaukset ovat päivien takaa (9.10., 12.10., 13.10.) — 15 min synkronointi **ei ole pyörinyt tuotannossa säännöllisesti**

Eli termostaatti on todennäköisesti lämmittänyt paljon enemmän — sovellus vain ei ole saanut mittauksia talteen, koska taustasynkronointi on ollut poikki suurimman osan ajasta. Luku "30 min" kuvaa siis mittausaineistoa, ei todellista lämmitystä.

## Korjaukset

### 1. Taustasynkronoinnin luotettavuus (pääsyy)
- Varmistetaan, että tuotannon 15 min synkronointityö (`ebeco-sync-15min`) todella ajautuu: tarkistetaan työn osoite ja salaisuus (sama ongelma kuin aiemmin rajavalvonnassa — työ saattaa osoittaa väärään osoitteeseen tai puuttuva varmenne estää ajon).
- Tämän jälkeen dataa kertyy ~96 pistettä/vrk/termostaatti ja lukemat muuttuvat realistisiksi.

### 2. Rehellisempi esitys termostaattisivulla
- Yhteenvedon teksti muutetaan kertomaan myös aineiston kattavuus, esim.:
  - "Lämmittänyt n. 30 min — perustuu 3 mittauspisteeseen viimeisen 24 h aikana (odotettu ~96)"
  - Kun aineisto on täysi: "Lämmittänyt n. 6 h viimeisen 24 h aikana"
- Jos mittauspisteitä on selvästi odotettua vähemmän, näytetään huomautus, että synkronointi on ollut poikki eikä luku ole kattava.

### 3. Lämmitysaste-näkymä
- Sama kattavuustieto näytetään myös Lämmitysaste-sivulla, jotta prosentit eivät johda harhaan puutteellisella datalla.

## Tekniset tiedot
- Taulu: `thermostat_readings` (`heating boolean`, `ts`), synkronointi: `src/lib/ebeco-sync.server.ts`, cron-työ: `ebeco-sync-15min` (`*/15 * * * *`).
- Yhteenvetoteksti: `src/routes/_authenticated.thermostats.$id.tsx`; lämmitysaste: `src/routes/_authenticated.heating.tsx`.
- Muutokset tulevat tuotantoon (unnamannu.app) julkaisun yhteydessä.
