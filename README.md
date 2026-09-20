# MontajPro

Aplicație web/PWA pentru montatori de **scări, parchet și plinte**: clienți,
lucrări, măsurători, fotografii, materiale, oferte, programări și bani — într-un
singur loc, optimizată în primul rând pentru telefon.

Interfața este integral în română. Moneda implicită este **MDL** și se poate
schimba din Setări (MDL, RON, EUR, USD, UAH, GBP).

---

## Ce face

| Modul | Ce rezolvă |
| --- | --- |
| **Dashboard** | Lucrări active, programul de azi, bani de încasat, încasări/cheltuieli/profit pe luna curentă, ore lucrate, materiale de cumpărat |
| **Lucrări** | Listă cu filtre pe status (ofertă, confirmată, materiale, în lucru, finalizată, problemă), preț / avans / rest pe fiecare card |
| **Pagina lucrării** | Tab-uri: General, Măsurători, Poze, Materiale, Finanțe, Activitate; buton mare **START / FINALIZEAZĂ** cu cronometru |
| **Clienți** | CRUD complet, istoric lucrări și plăți, fotografii, acțiuni rapide (sună, WhatsApp, hartă) |
| **Măsurători** | Scară / parchet / plintă / altceva, cu **calcule automate** (suprafețe, unghi, bucăți necesare, pierdere %) |
| **Calculator preț** | Alegi poziția, prețul și unitatea vin din tarifele din Setări; cantitățile pot veni direct dintr-o măsurătoare; salvează în lucrare sau ofertă |
| **Oferte** | Linii alese din aceleași poziții ca în calculator, cu prețul din Setări; numerotate automat, cu subtotal/reducere/avans/rest, format printabil și partajare prin WhatsApp/share nativ; se transformă într-o lucrare dintr-o apăsare |
| **Calendar** | Lunar și săptămânal, mutarea lucrării pe altă zi (drag pe desktop, buton pe telefon) |
| **Finanțe** | Încasări, cheltuieli pe categorii, profit, bani de primit, avansuri și câștigul pe oră — pe lună |
| **Materiale** | Inventar care scade când iei din depozit + listă de cumpărături care ține cont de ce ai deja pe raft |
| **Scule** | Evidență cu preț, dată cumpărare, garanție și alertă înainte de expirare |
| **Portofoliu** | Lucrările finalizate cu „înainte / după” |
| **Oferte trimise ca link** | Clientul deschide oferta în browser, fără cont, și o acceptă cu numele lui — confirmarea ajunge înapoi cu dată și oră |
| **Facturi** | Serie și număr, TVA, scadență, marcare ca achitată, printabilă; datele clientului se îngheață în factură |
| **Export contabil** | CSV pentru încasări, cheltuieli și facturi, cu separator `;` și virgulă zecimală, gata de deschis în Excel |
| **Notificări** | În aplicație și push pe telefon: lucrare azi/mâine, plată restantă, materiale lipsă, garanție care expiră, ofertă neconfirmată |
| **Căutare globală** | Un câmp peste clienți, lucrări, oferte, facturi, materiale, scule și măsurători (Ctrl/Cmd+K) |
| **Pașii lucrării** | Listă bifabilă pe prima filă a lucrării, pornită din șabloane pe tip, editabile în Setări |
| **Rapoarte** | Ce tip de lucrare aduce bani, preț mediu pe treaptă/m²/m, câștig pe oră, top clienți — doar din lucrări finalizate |
| **Proces-verbal de predare** | Ce s-a executat, garanția, pozele „după” și semnătura clientului desenată cu degetul |
| **PDF** | Ofertă, factură și proces-verbal se descarcă ca .pdf, identic pe orice telefon |
| **Echipă** | Al doilea om vede lucrarea, bifează pași, pornește cronometrul și pune poze — fără să vadă un leu, și fără să aibă nevoie de semnal |
| **Scadențar** | Tranșele lucrării (la semnare, la material, la predare) cu termen și memento; „am luat” scrie o încasare adevărată |
| **Cheltuieli fixe** | Chirie, leasing, telefon — se scad din profitul lunii, ca cifra să nu fie mai mare decât adevărul |
| **Setări** | Profil, monedă, unități, tarife și poziții proprii (cu import/export), pașii pe tip, categorii, notificări, echipă, backup, date demo |

## Stack

- **Next.js 16** (App Router) + **TypeScript**
- **Tailwind CSS v4** + componente în stil **shadcn/ui** (Radix UI)
- **Supabase** — PostgreSQL, autentificare, Storage
- **PWA** — manifest, service worker, instalare pe iPhone/Android
- **Lucide** pentru iconițe

## Arhitectură: local-first

Aplicația se folosește pe șantier, unde semnalul e slab sau lipsește. De aceea
datele nu se citesc direct din rețea:

```
UI (React)  ->  store în memorie  ->  IndexedDB          (instant, offline)
                      |
                      +--> outbox  ->  Supabase (push/pull)   (când există rețea)
```

- Fiecare scriere intră imediat în IndexedDB și în „outbox”.
- Motorul de sincronizare (`src/lib/db/sync.ts`) trimite outbox-ul și aduce
  modificările noi la pornire, la revenirea în aplicație, la recâștigarea
  semnalului și din minut în minut.
- Conflictele se rezolvă „last write wins” pe `updated_at`, iar cursorul de
  sincronizare este `synced_at`, pus de server — un telefon cu ceasul deviat nu
  poate ascunde rânduri.
- Ștergerile sunt logice (`deleted_at`), ca să se propage între dispozitive.
- Fotografiile se comprimă pe telefon, se salvează local și se urcă în Storage
  când se poate.

Fără chei Supabase aplicația pornește în **mod local**: totul funcționează, dar
datele rămân pe dispozitiv.

## Pornire

```bash
npm install
cp .env.example .env.local     # opțional, pentru sincronizare în cloud
npm run dev                    # http://localhost:3000
```

### Supabase (opțional, dar recomandat)

1. Creează un proiect pe [supabase.com](https://supabase.com).
2. Rulează migrațiile din `supabase/migrations/` în ordine (SQL Editor sau
   `supabase db push`):
   - `0001_init.sql` — tabelele, indecșii, triggerele și politicile RLS;
   - `0002_storage.sql` — bucket-ul privat `job-photos` și politicile lui;
   - `0003_quote_links_invoices_push.sql` — linkul public de ofertă, facturile
     și abonamentele push;
   - `0004_cron.sql` — programarea notificărilor zilnice (rulează după ce
     funcția Edge e publicată și secretele sunt în Vault);
   - `0005_restrict_internal_functions.sql` — retrage din browser dreptul de a
     apela funcțiile interne;
   - `0006_push_config.sql` — citirea secretelor push din Vault;
   - `0007_settings_price_list.sql` — pozițiile proprii din lista de prețuri;
   - `0008_handovers.sql` — procesele-verbale de predare;
   - `0009_job_tasks.sql` — pașii lucrării și șabloanele lor;
   - `0010_team.sql` — echipa și funcțiile prin care ajutorul vede lucrarea;
   - `0011_who_worked.sql` — numele celui care a lucrat, lângă id;
   - `0012_photo_stamp.sql` — data scrisă peste poze;
   - `0013_stock_usage.sql` — materialul scos din depozit;
   - `0014_follow_up_reminders.sql` — revenirea la client și garanția lucrării;
   - `0015_fixed_costs.sql` — cheltuielile fixe lunare;
   - `0016_installments.sql` — scadențarul de plăți;
   - `0017_shared_offline.sql` — orele ajutorului, scrise cu ceasul lor.
3. Pune `NEXT_PUBLIC_SUPABASE_URL` și `NEXT_PUBLIC_SUPABASE_ANON_KEY` în
   `.env.local`. Pentru aplicația publicată, aceleași două variabile se pun în
   setările proiectului de găzduire (pe Vercel: Settings → Environment
   Variables) — se citesc la build, deci după ce le adaugi trebuie un deploy nou.
4. Repornește `npm run dev` — apare ecranul de autentificare.

Row Level Security este activ pe toate tabelele: fiecare cont vede **doar**
propriile rânduri (`user_id = auth.uid()`), iar în Storage fiecare utilizator
scrie doar în folderul său (`<user_id>/...`).

## Oferta trimisă ca link

Din pagina ofertei, **Trimite link** generează un token lung și deschide
partajarea telefonului. Clientul vede documentul la `/oferta/<token>` și îl
poate accepta scriindu-și numele.

Ce se întâmplă în spate contează pentru siguranță: pagina publică **nu**
citește tabele. Totul trece prin două funcții din bază, `quote_by_token` și
`accept_quote`, care rulează cu drepturile definitorului și returnează doar
oferta cerută — și numai dacă tokenul e corect, oferta e trimisă și n-a expirat.
Cine deschide linkul nu capătă acces la nimic altceva; singurele câmpuri pe
care le poate schimba sunt statusul, ora acceptării și numele semnatarului.

Linkul funcționează doar cu Supabase configurat. În mod local butonul trimite,
ca înainte, un text.

## Al doilea om

Ajutorul intră cu contul lui, pe e-mailul la care a fost invitat din Setări →
Echipă, acceptă invitația și vede lucrările în meniul **Echipă**: titlu, tip,
adresă, client, notițe și pașii de bifat. Poate bifa pași, porni și opri
cronometrul și trimite poze de pe șantier.

Ce nu vede: prețuri, plăți, cheltuieli, oferte, facturi, rapoarte. Nu pentru
că sunt ascunse în interfață, ci pentru că nu ies din server.

Cum e construit contează aici: **RLS-ul existent nu s-a atins**. Fiecare rând
rămâne al unui singur cont, ca până acum, iar ajutorul ajunge la datele
patronului doar prin funcții din bază (`shared_*`), cu drepturile
definitorului, care returnează explicit câmp cu câmp. Ce nu e scris acolo nu
există pentru el, iar o greșeală într-o politică nouă n-are cum să deschidă
restul aplicației.

Merge și fără semnal, ca restul aplicației. Ce s-a citit ultima dată rămâne pe
telefon, cronometrul pornește local, iar bifele și orele lucrate se pun la
coadă și pleacă la primul internet — de oriunde din aplicație, nu doar de pe
ecranul Echipă. Orele se scriu cu ceasul lor adevărat: o sesiune terminată
dimineața și urcată seara rămâne de trei ore, nu de unsprezece.

## Notificări push

Motorul de notificări rulează în aplicație; push-ul le scoate din aplicație pe
ecranul telefonului. Se configurează o singură dată:

```bash
npx web-push generate-vapid-keys          # o pereche de chei
supabase functions deploy send-reminders --no-verify-jwt
```

Cheia publică merge în `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (`.env.local` pe
calculator, variabilele proiectului pentru aplicația publicată).

Cheia privată și restul secretelor stau în bază, în Vault — așa se pot pune
numai din SQL, fără acces la tabloul de bord:

```sql
select vault.create_secret('<cheia publică>',  'montajpro_vapid_public');
select vault.create_secret('<cheia privată>',  'montajpro_vapid_private');
select vault.create_secret('https://exemplu.md', 'montajpro_vapid_subject');
select vault.create_secret('<șir lung aleatoriu>', 'montajpro_cron_secret');
select vault.create_secret(
  'https://<PROJECT_REF>.supabase.co/functions/v1/send-reminders',
  'montajpro_functions_url');
```

Funcția le citește prin `public.push_config()`, pe care o poate chema doar
`service_role`. Cine preferă variabilele de mediu poate folosi în schimb
`supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... \
VAPID_SUBJECT=... CRON_SECRET=...`; mediul bate baza.

Apoi rulează `supabase/migrations/0004_cron.sql` — programează funcția zilnic
la 7:30 UTC, citind adresa și secretul tot din Vault, deci n-are nimic de
completat de mână.

Funcția se publică fără verificarea JWT (`--no-verify-jwt`) pentru că își face
singură verificarea, cu antetul `x-cron-secret`, și refuză tot dacă secretul nu
e configurat. Verificarea platformei ar fi lăsat să treacă orice utilizator
autentificat al proiectului, care ar fi putut astfel declanșa notificări pentru
toată lumea.

Din aplicație: **Setări → Notificări → Notificări pe telefon**. Pe iPhone,
push-ul funcționează doar după ce aplicația e adăugată pe ecranul principal.

Regulile stau în SQL (`public.due_reminders()`), nu în aplicație: telefonul
poate fi închis, notificările pleacă oricum.

## Verificări

```bash
npm run typecheck      # TypeScript
npm run lint           # ESLint (inclusiv regulile React Compiler)
npm test               # testele de sincronizare (Node, fără cloud)
npm run build          # build de producție
npm run test:smoke     # test de fum în browser (vezi mai jos)
npm run check          # toate cele de mai sus, în ordine
```

### Testele de sincronizare

`tests/sync.test.ts` pornește un **PostgREST fals** (`tests/fake-postgrest.mjs`)
și lasă clientul Supabase *adevărat* să vorbească cu el, peste un IndexedDB
fals. Așa se verifică fără niciun cont în cloud exact partea pe care testul de
fum n-o atinge:

- ce scriu local ajunge pe server, iar outbox-ul se golește;
- ce apare pe server ajunge local;
- cursorul avansează, deci a doua sincronizare nu reia totul;
- **un tabel refuzat nu blochează restul**: celelalte pleacă, pull-ul rulează,
  rândul problematic rămâne în outbox și se reîncearcă;
- două rânduri de setări rămân unul singur, cel mai vechi;
- pozele rămase locale se urcă la prima sincronizare;
- ștergerea logică ajunge pe server.

Testul de fum pornește un Chromium cu viewport de iPhone și parcurge fluxul
real: mod local → client nou → lucrare nouă → cronometru → măsurătoare cu
calcule → materiale → plată → calculator → ofertă → toate paginile →
persistență după reload → schimbarea monedei → fișierele PWA.

```bash
npm run build && npm run start -- -p 3100   # într-un terminal
BASE_URL=http://localhost:3100 npm run test:smoke
# CHROMIUM_PATH=/cale/spre/chromium  dacă vrei alt binar decât cel din Playwright
```

## Structura

```
src/
  app/
    (app)/            paginile aplicației (dashboard, lucrări, clienți, ...)
    (auth)/login/     autentificare + intrare în mod local
    oferta/[token]/   pagina publică a ofertei (fără cont, fără store local)
  components/
    ui/               primitive (buton, card, dialog, select, ...)
    layout/           sidebar, bară de jos, FAB, antet, cronometru activ
    forms/            dialoguri de adăugare/editare
    jobs/ quotes/ measurements/ photo/ dashboard/ notifications/
  lib/
    db/               store local, IndexedDB, sincronizare, acțiuni, date demo
    supabase/         clientul de browser
    calc.ts           calcule pentru măsurători, prețuri și finanțe
    export.ts         CSV pentru contabilitate
    push.ts           abonarea la notificări push
    format.ts         formatarea sumelor, datelor și duratelor (ro-RO)
    types.ts          modelul de date (oglindește schema Supabase)
supabase/migrations/  schema + RLS + Storage + funcții publice + cron
supabase/functions/   funcția Edge care trimite notificările
tests/smoke.mjs       test de fum în browser
tests/sync.test.ts    testele sincronizării, cu PostgREST fals
```

## Date demo

Setări → **Încarcă date demo** adaugă câțiva clienți, lucrări, plăți și o ofertă
de probă. Toate poartă marcajul `(DEMO)` în nume și se șterg dintr-o apăsare, ca
să nu se amestece niciodată cu datele reale.

## Instalare pe telefon

- **Android/Chrome**: bannerul de instalare sau Setări → *Instalează aplicația*.
- **iPhone/Safari**: *Partajează* → *Adaugă pe ecranul principal*.

## Pregătit pentru mai departe

Structura permite adăugarea fără rescrieri a: sincronizării cu Google Calendar,
generării automate de oferte cu AI pe baza istoricului propriu de prețuri și a
unui portal complet pentru client (pagina publică a ofertei este primul pas).

Un singur lucru de pe listă **nu** este o adăugare, ci un refactor: echipele cu
roluri. Astăzi totul atârnă de `user_id`; o echipă cere `team_id` peste tot și
politici RLS pe apartenență, nu pe proprietar.
