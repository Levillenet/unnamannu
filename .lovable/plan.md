## Ongelma

`/set-password` -sivun kentät ovat pois käytöstä, koska `ready`-tila jää `false`-arvoon. Sivu odottaa, että Supabase luo session automaattisesti URL-hashin tokenista (`onAuthStateChange`), mutta nykyiset Supabase-sähköpostilinkit käyttävät `?token_hash=...&type=recovery|invite` -muotoa (PKCE/verifyOtp), eikä vanhaa `#access_token=...` hash-muotoa. Siksi sessio ei koskaan synny → kentät pysyvät disabloituina.

## Korjaus

Päivitä `src/routes/set-password.tsx` käsittelemään kaikki kolme tapaa, jolla Supabase voi toimittaa palautus-/kutsutokenin:

1. **`?token_hash=...&type=recovery|invite|signup`** → kutsu `supabase.auth.verifyOtp({ token_hash, type })`.
2. **`?code=...`** (PKCE) → kutsu `supabase.auth.exchangeCodeForSession(code)`.
3. **`#access_token=...&refresh_token=...`** (vanha hash-flow) → kutsu `supabase.auth.setSession({ access_token, refresh_token })`.
4. Tarkista myös olemassa oleva sessio fallbackina.

Jos mikään yllä olevista ei tuota sessiota muutaman sekunnin sisällä, näytä virheviesti ja linkki `/reset-password`-sivulle, jotta käyttäjä voi pyytää uuden linkin (eikä jää loputtomaan "Käsitellään kutsua…" -tilaan).

Lisäksi:
- Vaihda `navigate({ to: "/dashboard" })` osoittamaan `/` (sovelluksessa ei välttämättä ole `/dashboard`-reittiä, suojattu juurihan ohjaa oikeaan paikkaan).
- Siivoa URL `window.history.replaceState`illa sen jälkeen, kun token on käytetty, ettei se jää näkyviin.

## Tekninen toteutus

Tiedostot:
- `src/routes/set-password.tsx` — kirjoita `useEffect`-lohko uudelleen siten, että se lukee `window.location.search` ja `window.location.hash`, kutsuu oikeaa Supabase-metodia ja asettaa `ready=true` onnistuessa tai `error`-tilan epäonnistuessa.

Ei muutoksia tietokantaan, RLS:ään tai muihin reitteihin.
