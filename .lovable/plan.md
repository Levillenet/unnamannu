## Tavoite

- Vain admin lisää uudet käyttäjät — login-sivulla ei voi luoda tunnusta
- Kutsu lähtee sähköpostiin → käyttäjä asettaa salasanan → kirjautuu sisään
- Kaksi roolia: **admin** (kaikki) ja **user** (kaikki paitsi termostaattien allokointi ja vyöhykkeiden lisäys/poisto)
- Kaikki muutokset kirjataan käyttäjäkohtaiseen lokiin
- Google-kirjautuminen pois

## Roolit

Päivitetään `app_role`-enum: lisätään `admin` ja `user` (säilytetään `manager` taaksepäin yhteensopivuuden vuoksi, mutta uudet käyttäjät saavat `admin` tai `user`).

| Toiminto | admin | user |
|---|---|---|
| Lämpötilan / aikataulun säätö | ✓ | ✓ |
| Vyöhykkeen oletusten muokkaus (slidereiden tallennus) | ✓ | ✓ |
| Vyöhykkeen **lisäys / poisto** | ✓ | ✗ |
| Termostaatin **allokointi** huoneistoon / vyöhykkeen vaihto | ✓ | ✗ |
| Käyttäjien hallinta ja kutsut | ✓ | ✗ |
| Lokin tarkastelu | ✓ | ✗ |

Olemassa olevat RLS-politiikat käyttävät `has_role(auth.uid(), 'manager')`. Lavennetaan ne hyväksymään sekä `admin` että `user`, ja rajataan admin-toiminnot omilla `has_role(..., 'admin')`-tarkistuksilla server-funktioissa.

## Tietokantamuutokset (migraatio)

```sql
-- 1. Roolit
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'admin';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'user';

-- 2. handle_new_user(): EI enää oletuksena 'manager'.
--    Roolin asettaa admin invite-virrassa erikseen.
--    Trigger luo profiilin (jos profiles-taulu lisätään) muttei rooli-riviä.

-- 3. profiles-taulu (näyttönimi, sähköposti cache)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid());

-- 4. audit_log
CREATE TABLE public.audit_log (
  id bigserial PRIMARY KEY,
  ts timestamptz NOT NULL DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text,
  action text NOT NULL,        -- esim. 'thermostat.setpoint', 'zone.create', 'user.invite'
  entity_type text,            -- 'thermostat' | 'zone' | 'apartment' | 'user' ...
  entity_id text,
  details jsonb
);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read audit log" ON public.audit_log
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated insert audit log" ON public.audit_log
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- 5. Päivitetään olemassa olevat RLS-politiikat: 'manager' OR 'admin' OR 'user'
--    Lisäksi rajataan kirjoitukset zone_defaults: admin saa INSERT/DELETE,
--    user vain UPDATE.
```

## Kutsuvirta

1. Admin avaa **Asetukset → Käyttäjät** → "Kutsu käyttäjä" (sähköposti + rooli)
2. Server-fn `inviteUser` (admin-suojattu) kutsuu `supabaseAdmin.auth.admin.inviteUserByEmail(email, { redirectTo: '<origin>/set-password' })` ja kirjoittaa `user_roles`-rivin invitelle (kytketään user_id:hen palautuksessa)
3. Käyttäjä saa sähköpostin → klikkaa linkkiä → `/set-password`-sivu, jossa asettaa salasanan (`supabase.auth.updateUser({ password })`)
4. Login-sivu yksinkertaistetaan: vain "Kirjaudu" + "Unohditko salasanan?" → `/reset-password`. **Pois:** Luo tili -välilehti ja Google-painike.

### Sähköposti

Supabase Auth lähettää oletuskutsut automaattisesti — ei vaadi erillistä email-infraa toimiakseen heti. Jos haluat oman domainin / brändätyt viestit, lisätään myöhemmin (Cloud → Emails).

## Muutosloki

Lisätään `src/lib/audit.server.ts` -helper `logAudit({ action, entityType, entityId, details })` joka kirjoittaa `audit_log`-tauluun käyttäjän kontekstissa (`requireSupabaseAuth`).

Kutsutaan jokaisessa kirjoitusoperaatiossa `data.functions.ts`:ssä:
- `thermostat.setpoint`, `thermostat.lock`, `thermostat.allocate`
- `zone.create`, `zone.update`, `zone.delete`, `zone.apply_max_to_all`
- `schedule.create/update/delete/assign`
- `user.invite`, `user.role_change`, `user.remove`

UI: **Asetukset → Loki** -välilehti (vain admin) — suodatus käyttäjän, toiminnon ja päivämäärän mukaan.

## UI-muutokset

- **`/login`**: poistetaan "Luo tili" -tab ja Google-painike. Lisätään "Unohditko salasanan?"
- **`/set-password`** (uusi, julkinen): salasanan asetus invitestä
- **`/reset-password`** (uusi, julkinen): salasanan uudistus
- **`/settings`** saa kaksi uutta välilehteä (vain admin):
  - **Käyttäjät**: lista (sähköposti, rooli, viimeisin kirjautuminen), Kutsu-nappi, roolin vaihto, poisto
  - **Loki**: audit_log selain
- **`/zones`**: piilotetaan/poistetaan "Lisää vyöhyke", "Poista vyöhyke" ei-admin-käyttäjiltä
- **`/apartments/$id`** ja **`/thermostats/$id`**: termostaatin huoneisto/vyöhyke-valinta vain admin
- Sivupalkkiin lisätään pieni rooli-merkki nimen alle

Roolin tarkistus reactissa: lisätään `useCurrentRole()`-hook joka hakee `user_roles`-tauluista (cachetetaan TanStack Queryllä).

## Server-funktiot (uudet, `src/lib/users.functions.ts` + `audit.functions.ts`)

- `getCurrentRole()` — palauttaa kirjautuneen käyttäjän roolin
- `listUsers()` — admin: profiles + roles + viimeisin kirjautuminen
- `inviteUser({ email, role })` — admin
- `updateUserRole({ userId, role })` — admin
- `removeUser({ userId })` — admin (kutsuu `supabaseAdmin.auth.admin.deleteUser`)
- `listAuditLog({ filters })` — admin

Lisätään admin-middleware `requireAdmin` joka rakentuu `requireSupabaseAuth`:n päälle ja tarkistaa `has_role(auth.uid(), 'admin')`.

## Ensimmäinen admin

Kun migraatio ajetaan, sinulle ei automaattisesti tule admin-roolia. **Tehdään seuraavasti:** migraation lopussa ajetaan kerta­insertti, joka antaa nykyiselle ainoalle käyttäjälle (sinulle) `admin`-roolin — tämän jälkeen voit kutsua muut käyttäjät UI:sta.

## Toteutusjärjestys

1. Migraatio (roolit, profiles, audit_log, RLS-päivitykset, ensimmäinen admin)
2. `users.functions.ts`, `audit.functions.ts`, `requireAdmin`-middleware
3. `useCurrentRole`-hook + sivupalkin rooli-merkki
4. Login-sivun siivous + `/set-password` + `/reset-password`
5. Asetukset → Käyttäjät -välilehti (kutsu, rooli, poisto)
6. Asetukset → Loki -välilehti
7. Roolirajoitukset zones / apartments / thermostats UI:ssa ja server-funktioissa
8. Audit-kutsut kaikkiin olemassa oleviin mutaatioihin

## Varmistukset

- Pitääkö **olemassa oleva `manager`-rooli** muuntaa adminiksi vai jättää erilliseksi tasoksi? Ehdotan: migroidaan kaikki nykyiset `manager`-rivit `admin`-rooliin ja poistetaan `manager` käytöstä koodissa.
- Riittääkö että `user` voi **muokata vyöhykkeen oletuksia** (oletuslämpö, max, pitoaika, grace) mutta ei lisätä/poistaa vyöhykettä? (Tämä on plania.) Jos haluat että user EI saa muuttaa edes vyöhykeoletuksia, sano niin.
- OK että käytetään Supabasen oletus-kutsusähköpostia (toimii heti, mutta lähettäjä on oletusosoite) — vai haluatko heti brändätyt viestit omasta domainista?
