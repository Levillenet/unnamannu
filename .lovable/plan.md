## Tavoite

Admin luo käyttäjätilin järjestelmässä ilman sähköpostikutsua. Käyttäjä saa väliaikaisen salasanan adminilta itseltään (esim. WhatsApp) ja vaihtaa sen ensikirjautumisen yhteydessä omaan. "Unohdin salasanani" -toiminto käyttäjälle säilyy.

## Uusi flow

1. Admin avaa "Lisää käyttäjä" -dialogin → syöttää sähköpostin, roolin ja muut nykyiset kentät.
2. Server function luo auth-käyttäjän valmiiksi vahvistettuna (`email_confirm: true`) ja generoi turvallisen 12-merkkisen väliaikaisen salasanan. Asettaa `profiles.must_change_password = true`.
3. Adminille näytetään **modaali**: sähköposti + väliaikainen salasana + "Kopioi" -nappi + huomautus "Salasana näytetään vain kerran". Admin välittää sen käyttäjälle haluamallaan tavalla.
4. Käyttäjä menee `/auth`-sivulle, kirjautuu sähköpostilla + väliaikaisella salasanalla.
5. `_authenticated/route.tsx` -gate tarkistaa `must_change_password`-lipun ja ohjaa `/set-password`-sivulle. Käyttäjä asettaa oman salasanansa → lippu nollataan → ohjataan etusivulle.
6. Käyttäjälle jää näkyviin **"Unohdin salasanani"** -linkki `/auth`-sivulle (toimii nykyisellä `resetPasswordForEmail`-kutsulla — huom. tämä vaatii edelleen sähköpostin toimivuuden ollakseen luotettava, mutta jätetään varatoiminnoksi).

## Adminin työkalut käyttäjäkortilla

- Korvataan **"Lähetä kutsu uudelleen"** napilla **"Nollaa salasana"** → generoi uuden satunnaisen väliaikaisen salasanan, asettaa `must_change_password = true` ja näyttää modaalin uudestaan adminille.

## Tekniset muutokset

### Tietokanta
- Migraatio: lisätään `profiles.must_change_password BOOLEAN NOT NULL DEFAULT false`.

### Server functions (`src/lib/users.functions.ts` tms.)
- **`createUserWithTempPassword({ email, role, ... })`** — admin-only. `supabaseAdmin.auth.admin.createUser({ email, password: <random>, email_confirm: true })`, kirjoittaa rooli + profiili + `must_change_password = true`, palauttaa `{ tempPassword }`.
- **`resetUserPassword({ userId })`** — admin-only. `supabaseAdmin.auth.admin.updateUserById(userId, { password: <random> })` + `must_change_password = true`, palauttaa uuden väliaikaisen salasanan.
- **`completePasswordChange()`** — käyttäjä itse, nollaa `must_change_password = false` (salasanan vaihto itsessään tehdään selaimessa `supabase.auth.updateUser({ password })`).
- Poistetaan / korvataan nykyinen `inviteUser`-kutsu.

### UI
- **"Lisää käyttäjä" -dialogi** — sama lomake, mutta onnistumisen jälkeen näyttää `TempPasswordModal`in (sähköposti + salasana + kopio).
- **`/set-password`-sivu** — olemassa jo invite-flowia varten; muokataan toimimaan myös sisäänkirjautuneelle käyttäjälle jolla `must_change_password = true`. Käyttäjä syöttää uuden salasanan kahdesti.
- **`_authenticated/route.tsx`** — ei kosketa managed-osuutta; sen sijaan lapsireitit (esim. uusi pieni `_authenticated/route.tsx`-tason redirect tai pieni komponenttitason check root-layoutissa) tarkistaa profiilin lipun ja ohjaa `/set-password`-sivulle. Toteutus: `_authenticated`-layoutin alla pieni "PasswordChangeGate"-komponentti joka `useQuery`:lla hakee oman profiilin ja navigoi tarvittaessa.
- **Käyttäjäkortti adminille** — "Lähetä kutsu uudelleen" → "Nollaa salasana".

## Mitä poistuu

- Supabasen `inviteUserByEmail`-kutsu ja siihen liittyvä epäluotettava sähköpostiriippuvuus admin-flowissa.

## Säilyy

- Käyttäjän oma "Unohdin salasanani" `/auth`-sivulla (`resetPasswordForEmail`).
- Google-kirjautuminen (jos käytössä) toimii ennallaan.
