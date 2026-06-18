# Job Aggregator — Design Specification

## [S1] Problem

Budujemy aplikację webową (Agregator ofert pracy), która agreguje oferty pracy z wielu zewnętrznych źródeł i prezentuje je w jednym miejscu z zaawansowanymi filtrami. Aplikacja składa się z dwóch części: scrapera danych uruchamianego co godzinę oraz interfejsu użytkownika z wyszukiwarką i tabelą ofert.

## [S2] Stack technologiczny

- **Frontend + API:** Next.js 14+ (App Router)
- **Stylizacja:** Tailwind CSS
- **Baza danych:** PostgreSQL
- **ORM:** Prisma
- **Cron:** node-cron
- **HTTP:** node-fetch / axios

## [S3] Struktura katalogów

```
workfinder/
├── prisma/
│   └── schema.prisma
├── src/
│   ├── app/
│   │   ├── page.tsx
│   │   ├── layout.tsx
│   │   └── api/
│   │       ├── jobs/route.ts
│   │       ├── jobs/[id]/route.ts
│   │       ├── sync/route.ts
│   │       └── stats/route.ts
│   ├── lib/
│   │   ├── db.ts
│   │   └── cron.ts
│   ├── scrapers/
│   │   ├── index.ts
│   │   ├── types.ts
│   │   ├── justjoin.ts
│   │   ├── pracuj.ts
│   │   ├── nofluffjobs.ts
│   │   ├── bulldogjob.ts
│   │   └── olx.ts
│   └── components/
│       ├── JobTable.tsx
│       ├── Filters.tsx
│       └── SearchBar.tsx
├── package.json
└── .env
```

## [S4] Model danych

```prisma
model JobOffer {
  id              String   @id @default(uuid())
  source          String
  externalId      String
  sourceUrl       String   @unique
  title           String
  company         String
  city            String?
  region          String?
  remote          Boolean  @default(false)
  workMode        String?
  salaryMin       Int?
  salaryMax       Int?
  salaryCurrency  String?  @default("PLN")
  technologies    String[]
  description     String?
  publishedAt     DateTime?
  fetchedAt       DateTime @default(now())
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([source, externalId])
  @@index([city])
  @@index([technologies])
  @@index([salaryMin, salaryMax])
  @@index([publishedAt])
}
```

Unikalność: `sourceUrl` jako constraint zapobiega duplikatom.

## [S5] Źródła danych

| # | Źródło       | Typ         | Trudność |
|---|-------------|-------------|----------|
| 1 | JustJoin.it | API JSON    | Niska    |
| 2 | NoFluffJobs | API JSON    | Niska    |
| 3 | BulldogJob  | API JSON    | Niska    |
| 4 | Pracuj.pl   | HTML scrape | Średnia  |
| 5 | OLX         | HTML scrape | Średnia  |
| 6 | LinkedIn    | HTML scrape | Wysoka   |

## [S6] Architektura scraperów

**Wspólny interfejs:**
```typescript
interface Scraper {
  name: string;
  fetchJobs(): Promise<JobOfferInput[]>;
}

interface JobOfferInput {
  source: string;
  externalId: string;
  sourceUrl: string;
  title: string;
  company: string;
  city?: string;
  region?: string;
  remote: boolean;
  workMode?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  technologies: string[];
  description?: string;
  publishedAt?: Date;
}
```

**Logika:**
- Scrapery uruchamiane równolegle (Promise.allSettled)
- Błąd jednego scrapera nie blokuje pozostałych
- Deduplikacja: sprawdzenie `sourceUrl` przed zapisem
- Aktualizacja: jeśli oferta istnieje, aktualizuje `salaryMin/Max` i `technologies`

## [S7] Interfejs użytkownika

**Layout:**
- Górny pasek: wyszukiwarka + przycisk "Odśwież dane"
- Lewa strona: panel filtrów (accordion)
- Środek: tabela ofert z paginacją
- Responsywność: filtry w modalu na mobile

**Filtry:**
- Wyszukiwarka tekstowa (tytuł, firma, technologie)
- Zakres wynagrodzenia (min/max slider)
- Miasto (dropdown z auto-complete)
- Technologie (multi-select z tagami)
- Tryb pracy (checkboxy: remote/office/hybrid)
- Nazwa firmy (input text)
- Data publikacji (ostatnie 24h / tydzień / miesiąc / wszystkie)

**Tabela:**
- Kolumny: Firma, Tytuł, Lokalizacja, Zarobki, Technologie, Tryb pracy, Źródło, Data
- Sortowanie po kolumnach
- Paginacja (25/50/100 na stronę)
- Link do oryginalnej oferty

## [S8] Cron Job i API

**Cron Job:**
- Harmonogram: `0 * * * *` (co godzinę)
- Uruchamiany przy starcie serwera
- Logowanie statystyk (pobrano/nowe/zaktualizowane/błędy)
- Opcjonalne wyłączenie via env var

**API Routes:**
```
GET  /api/jobs          — lista ofert z filtrami + paginacją
GET  /api/jobs/[id]     — szczegóły oferty
POST /api/sync          — ręczne uruchomienie sync
GET  /api/stats         — statystyki
```

**Parametry GET /api/jobs:**
```
?page=1&limit=25
&search=react
&city=Warszawa
&technology=React,TypeScript
&workMode=remote
&salaryMin=10000&salaryMax=20000
&company=mBank
&publishedAfter=2024-01-01
&sort=salaryMax&order=desc
```

## [S9] Hosting

Aplikacja uruchamiana lokalnie na komputerze użytkownika. PostgreSQL lokalny lub w Dockerze.
