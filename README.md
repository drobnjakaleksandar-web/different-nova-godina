# Restoran Different · Nova Godina 2027

Aplikacija za evidenciju prodaje mesta po stolovima. Mapa stolova kao na plakatu, upis gostiju po imenima, status rezervisano/plaćeno, spisak gostiju za Excel i poruka sa slobodnim mestima. Svi koji znaju šifru vide isto stanje (osvežava se na svakih nekoliko sekundi).

## Postavljanje (jednom, oko 15 minuta)

### 1. Supabase (baza)
1. Napravite nalog na https://supabase.com i kliknite **New project** (region: Frankfurt / eu-central).
2. Kada se projekat napravi: **SQL Editor → New query**, nalepite ceo sadržaj fajla `supabase/schema.sql` i kliknite **Run**.
3. **Project Settings → API**, zapišite:
   - **Project URL** → to je `SUPABASE_URL`
   - **secret** ključ (ili stari **service_role**) → to je `SUPABASE_SECRET_KEY`. Ovaj ključ nikome ne dajte.

### 2. Vercel
1. Na https://vercel.com: **Add New → Project**, izaberite ovaj GitHub repozitorijum.
2. Pre klika na **Deploy**, u **Environment Variables** dodajte:

| Ime | Vrednost |
|---|---|
| `SUPABASE_URL` | Project URL iz Supabase |
| `SUPABASE_SECRET_KEY` | secret / service_role ključ |
| `APP_PIN` | zajednička šifra za ulaz (npr. 6 cifara) |
| `SESSION_SECRET` | dugačak nasumičan tekst, 40+ znakova |

3. Kliknite **Deploy**. Dobijete adresu tipa `different-nova-godina.vercel.app` koju šaljete kolegama zajedno sa šifrom.

### Promena šifre
U Vercelu promenite `APP_PIN` i uradite **Redeploy**. Svi uređaji se tada odjavljuju i moraju da ukucaju novu šifru.

### Na telefonu kao aplikacija
Otvorite adresu u Safariju (iPhone) ili Chromeu (Android) → **Dodaj na početni ekran**.

## Važno
- Dve istovremene prodaje ne mogu da prepune isti sto: baza zaključava sto dok proverava slobodna mesta.
- Raspored i kapacitet stolova su u `lib/tables.ts` (stolovi 2, 4–11, 19 i 28 po 10 mesta, ostali po 12; ukupno 410). Cene po zonama su u istom fajlu.
- Podaci o gostima su dostupni samo preko aplikacije sa šifrom; baza je zatvorena za sve ostale.

## Lokalno pokretanje (za programere)
```
cp .env.example .env.local   # popuniti vrednosti
npm install
npm run dev
```
