# Vyöhykepoikkeus termostaatille

## Tavoite
Yksittäiselle termostaatille (esim. B1 eteinen) voi antaa oman oletuslämpötilan ja asiakkaan ylärajan, jotka poikkeavat vyöhykkeestä. Poikkeukset näkyvät selvästi, jotta ne eivät unohdu.

## Toiminta
1. **Termostaatin sivu:** uusi kytkin "Poikkeava asetus vyöhykkeestä". Kun se on päällä, näytetään omat säätimet: oletuslämpötila ja asiakkaan yläraja (laiterajaan asti), valinnainen syy (esim. "kylmä eteinen") ja valinnainen päättymispäivä. Jos kytkimen laittaa pois, termostaatti palaa heti vyöhykkeen arvoihin.
2. **Vyöhykkeen tallennus ja Synkronoi-nappi:** poikkeavat termostaatit jätetään oletuksena pois. Kortissa näkyy "Poikkeus käytössä: B1 eteinen (oletus 22 °C, yläraja 24 °C)". Kun painat tallennusta, sovellus kysyy erikseen: "Koskeeko muutos myös näitä poikkeavia termostaatteja?" Jos vastaat kyllä, niiden poikkeus poistetaan.
3. **Automaattinen valvonta:** poikkeavalla termostaatilla tunnin välein ajettava tarkistus käyttää termostaatin omaa ylärajaa ja oletusta, ei vyöhykkeen. Kun päättymispäivä menee ohi, poikkeus päättyy itsestään ja termostaatti palaa vyöhykkeen arvoihin.
4. **Etusivu:** uusi huomautus "X termostaatilla vyöhykkeestä poikkeava asetus". Siitä pääsee listaan.
5. **Lämmitysaste-sivu:** poikkeavilla termostaateilla näkyy merkki "Poikkeus" ja omat arvot. Lisäksi tulee suodatin "Vain poikkeukset".

## Tekniset yksityiskohdat
- Migraatio `thermostats`-tauluun: `zone_override boolean default false`, `override_default_setpoint numeric`, `override_note text`, `override_until timestamptz`, `override_set_at timestamptz`, `override_set_by uuid`. Kaikki kentät nullable tai niillä on oletusarvo, joten muutos ei riko vanhaa.
- `updateThermostat` / uusi `setThermostatZoneOverride` (requireSupabaseAuth): tallentaa arvot, lähettää ne Ebecoon (`temperatureSet`, `maxSetpoint`, ja yhdistää patchin tuoreeseen tilaan) ja kirjaa tapahtuman audit-lokiin.
- `saveZoneDefault` ja vyöhykkeen synkronointi: uusi parametri `includeOverrides`. Kun se on false, rivit, joilla `zone_override=true`, suodatetaan pois. Paluuarvoon lisätään `skippedOverrides` (nimet).
- `enforcement.server.ts`: kun `zone_override` on päällä, käytetään `override_default_setpoint`-arvoa vyöhykkeen oletuksen sijaan. Vanhentunut `override_until` nollaa poikkeuksen ja palauttaa vyöhykkeen arvot.
- `getHeatingDuty` ja `getBuildingOverview` palauttavat poikkeuskentät ja poikkeusten määrän.
