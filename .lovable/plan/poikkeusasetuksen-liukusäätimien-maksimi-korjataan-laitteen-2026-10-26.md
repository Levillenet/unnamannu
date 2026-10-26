# Poikkeusasetuksen liukusäätimien maksimi korjataan laitteen todelliseen rajaan

## Ongelma

B1 eteisen termostaatilla poikkeusasetuksen liukusäätimet (oma oletuslämpötila ja oma asiakkaan yläraja) menevät vain 22 °C:een asti, vaikka pitäisi voida nostaa vaikka 25 °C:een.

**Varmistettu syy:** Kun asiakkaan ylärajaa tallennetaan, sovellus kirjoittaa sen myös termostaatin "laitteen maksimi" -kentän päälle (`updateThermostat`, rivi 353: `max_setpoint = guest_max_setpoint`). Poikkeuskortti puolestaan käyttää juuri tätä kenttää liukusäätimien ylärajana (`deviceMax = t.max_setpoint ?? 35`). Koska B1 eteisen yläraja on 22, myös kenttä on 22 — ja säätimet eivät pääse sitä korkeammalle. Laitteen todellinen maksimi (yleensä 35 °C) on siis korvautunut asiakkaan ylärajalla.

## Mitä "Poikkeava asetus vyöhykkeestä" tarkoittaa (selitys käyttäjälle)

Kytkin päällä = tällä termostaatilla on omat arvot (oma oletus ja oma yläraja), jotka ohittavat vyöhykkeen arvot. Kytkin pois = termostaatti palaa heti vyöhykkeen arvoihin. Tämä toiminta säilyy ennallaan — korjataan vain liukusäätimien rajat.

## Muutokset

1. **`updateThermostat` (src/lib/data.functions.ts):** poistetaan rivi, joka korvaa `max_setpoint`-kentän asiakkaan ylärajalla. Kenttä säilyttää laitteen todellisen maksimin.
2. **Poikkeuskortin liukusäätimet (termostaatin sivu):** yläraja luetaan laitteen todellisesta maksimista. Ensisijainen lähde: Ebeco-synkronoinnin tallentama `ebeco_settings.maxSetpoint` (laitteen ilmoittama todellinen raja); varmuusvarona 35 °C. Tällöin säädintä voi nostaa esim. 25 °C:een.
3. **Kannan siistiminen:** korjataan ne termostaatit, joiden `max_setpoint` on aiemmin korvautunut ylärajalla — palautetaan laitteen todellinen maksimi `ebeco_settings.maxSetpoint`-arvosta (tai 35, jos tietoa ei ole). Tämä tehdään kyselyllä, ei migraationa.
4. **Varmistus:** avataan B1 eteisen termostaatin sivu ja tarkistetaan, että poikkeusasetuksen säätimet menevät laitteen maksimiin asti, ja tallennetaan testiksi yläraja 25 °C ja katsotaan, että se menee perille Ebecoon.

## Tekniset yksityiskohdat

- `src/lib/data.functions.ts` rivi ~353: poistetaan `(patch as any).max_setpoint = patch.guest_max_setpoint`.
- `src/routes/_authenticated.thermostats.$id.tsx` `ZoneOverrideCard`: `deviceMax = Number(t.ebeco_settings?.maxSetpoint ?? t.max_setpoint ?? 35)`.
- Kannan korjaus: `UPDATE thermostats SET max_setpoint = COALESCE((ebeco_settings->>'maxSetpoint')::numeric, 35) WHERE max_setpoint < COALESCE((ebeco_settings->>'maxSetpoint')::numeric, 35)` — tarkistetaan ensin SELECTillä, mitä rivejä koskee.
- Ei migraatiota, ei skeemamuutoksia.
