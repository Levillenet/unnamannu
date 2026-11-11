# Kirjautuminen jää tilaan "Kirjaudutaan…"

## Havainto
Kirjautumislokin mukaan salasanasi hyväksytään joka kerta. Jumi tulee vasta sen jälkeen, kun etusivua avataan. Syytä en ole vielä varmistanut.

## Askeleet
1. **Toistan vian:** kirjaudun tunnuksellasi esikatseluun ja mittaan, mikä haku jää odottamaan (kirjautumisen tarkistus, rooli, salasanan vaihtopakko tai etusivun luvut).
2. **Korjaan juuri sen kohdan.** Lisäksi teen varmistuksen: jos etusivu ei avaudu 10 sekunnissa, napista poistuu "Kirjaudutaan…" ja näytetään viesti "Kirjautuminen onnistui, mutta etusivun lataus kestää" sekä "Yritä uudelleen" -painike. Silloin et jää jumiin.
3. **Hätäreitti:** jos tarkistus "pitääkö vaihtaa salasana" epäonnistuu tai kestää liian kauan, se ei enää estä pääsyä sisään.
4. **Testaan** kirjautumisen alusta loppuun tunnuksellasi ja kerron mitatun ajan.

## Huomio
Edelliset korjaukset näkyvät osoitteessa unnamannu.app vasta julkaisun jälkeen. Tämäkin korjaus pitää julkaista.

## Tekninen
- Playwright + `lovable auth-session` → mittaa verkkopyynnöt (getUser, getMustChangePassword, getCurrentRole, getBuildingOverview, listApartments).
- `login.tsx`: 10 s aikakatkaisu `loading`-tilalle.
- `_authenticated.tsx`: mustChange-kysely ei estä; `retry: 1`, virhe ohitetaan.
