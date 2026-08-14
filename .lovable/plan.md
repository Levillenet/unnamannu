# Korjaus: vyöhykkeen max-pitoajan tallennus epäonnistuu

## Ongelma

Kun vyöhykkeen asetuksia (esim. max-pitoaika) muutetaan, tallennus kaatuu virheeseen
`new row violates row-level security policy for table "zone_defaults"`.

Syy: tallennus tehdään aina "upsert"-operaationa, joka tietokannan silmissä on aina myös
uuden rivin lisäys. Vyöhykkeen luonti on sallittu vain ylläpitäjille, joten tavallisella
käyttäjällä olemassa olevan vyöhykkeen muokkauskin torjutaan — vaikka muokkaus sinänsä
olisi sallittu.

## Ratkaisu

Erotetaan muokkaus ja luonti toisistaan tallennuslogiikassa:

- Jos vyöhyke on jo olemassa: tehdään pelkkä päivitys olemassa olevaan riviin (sallittu
  kaikille rooleille).
- Jos vyöhykettä ei ole: tehdään lisäys kuten ennenkin, ylläpitäjän oikeuksien tarkistuksen
  jälkeen.

Muuta toiminnallisuutta (vyöhykkeen soveltaminen termostaatteihin, audit-loki) ei muuteta.

## Tekniset yksityiskohdat

- `src/lib/data.functions.ts` → `saveZoneDefault`: korvataan
  `.upsert(row, { onConflict: "building_id,zone" })` haaralla:
  - `existing` löytyy → `.update(row).eq("id", existing.id)`
  - muuten → admin-tarkistus (jo olemassa) + `.insert(row)`
- Tietokantaan ei tehdä muutoksia; nykyiset käyttöoikeussäännöt riittävät.
