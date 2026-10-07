# Taustatöiden tiheyden pienentäminen

## Tausta
Palvelu kuluttaa krediittejä myös silloin, kun kukaan ei käytä sovellusta: palvelimen ajo, tietokanta ja ajastetut taustatyöt. Aiempi väite, ettei taustatyö kuluta krediittejä lainkaan, oli väärä.

Kirjattu kulutus tälle projektille 24.9.–7.10.2026:
- Rakentaminen ja chat: 6,45 krediittiä
- Palvelimen ajopäivät: 0,23 krediittiä (23 päivää)
- Tietokannan ajoaikaa ei ole kirjattu tälle jaksolle. Sen kulutus on siis tarkistamatta, ei nolla. Jatkuvasti päällä oleva pienin tietokanta maksaisi nykyhinnalla noin 56 krediittiä 30 päivässä, ennen kuin kuukausittainen 20 krediitin Cloud-etu vähennetään.

## Muutos
1. Rajojen valvonta ajetaan 15 minuutin välein, ei enää minuutin välein. Palautusaika voi siksi venyä enintään noin 15 minuuttia.
2. Ebeco-synkronointi ajetaan 15 minuutin välein, ei enää 5 minuutin välein.
3. Vyöhykeasetuksen ohjeteksti kertoo, että palautus tapahtuu seuraavalla tarkistuskierroksella (enintään noin 15 min).
4. Kulutus tarkistetaan uudelleen noin viikon kuluttua, jotta nähdään, laskiko se.

## Tekniset tiedot
- Kaksi ajastettua tehtävää päivitetään: `enforce-limits` (`* * * * *` → `*/15 * * * *`) ja `ebeco-sync-5min` (`*/5` → `*/15`).
- Sovelluksen avoimen istunnon 60 sekunnin tarkistus jätetään ennalleen. Se toimii vain, kun ylläpitäjä on kirjautuneena.
- Tiheyden pienentäminen vähentää palvelinpyyntöjä ja tietokannan kuormaa. Säästö on arvio, kunnes se näkyy laskutuksessa.
