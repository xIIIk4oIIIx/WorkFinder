<div align="center">

# 🔍 WorkFinder

**Polski agregator ofert pracy z 7 portali**

Przeszukuj oferty pracy z NoFluffJobs, BulldogJob, OLX, JustJoin, RocketJobs, Jooble i Pracuj.pl w jednym miejscu.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql)](https://www.postgresql.org)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma)](https://www.prisma.io)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

</div>

---

## ✨ Funkcjonalności

<table>
<tr>
<td width="50%">

### 🔎 Wyszukiwarka
- Pełnotekstowe przeszukiwanie po tytule, firmie i technologiach
- Debounce inputu dla wydajności
- Historia wyszukiwań (localStorage)

### 🎛️ Filtry wielowymiarowe
- Tryb pracy: Remote / Office / Hybrid
- Miasto, technologia, firma
- Zakres wynagrodzenia (suwak 0–100k PLN)
- Wybór i wykluczenie źródeł

</td>
<td width="50%">

### 🤖 AI Podsumowania
- Generowanie podsumowań przez Google Gemini
- Streaming via SSE w czasie rzeczywistym
- Automatyczny fallback między modelami
- 5 sekcji: obowiązki, benefity, uwagi, zespół, perspektywy

### 📊 Statystyki
- Łączna liczba ofert
- Nowe oferty dzisiaj
- Aktywne źródła
- Ostatnia synchronizacja

</td>
</tr>
</table>

---

## 🔄 Scrapery

WorkFinder agreguje oferty z **7 polskich portali IT**:

| Portal | Metoda | Opis |
|--------|--------|------|
| **NoFluffJobs** | REST API | Pełne dane technologiczne, paginacja |
| **BulldogJob** | GraphQL API | Strukturalne dane |
| **OLX** | REST API | Ogłoszenia prywatne i firmowe |
| **JustJoin** | HTML + RSC | Parsing React Server Components |
| **RocketJobs** | HTML + RSC | Parsing React Server Components |
| **Jooble** | POST API | Darmowe API z rate limiting |
| **Pracuj.pl** | Playwright | Headless Chromium, ominięcie Cloudflare |

> ⏰ Scrapery uruchamiane automatycznie co godzinę (node-cron)

---

## 🏗️ Architektura

```
┌─────────────────────────────────────────────────────────┐
│                    Prezentacja                          │
│          Next.js App Router + React 19                  │
├─────────────────────────────────────────────────────────┤
│                     API Layer                           │
│              Route Handlers (REST)                      │
├─────────────────────────────────────────────────────────┤
│                  Data Access Layer                      │
│              Prisma 7 + PostgreSQL                      │
├─────────────────────────────────────────────────────────┤
│               External Integrations                     │
│          Scrapers + Google Gemini API                   │
└─────────────────────────────────────────────────────────┘
```

### Kluczowe decyzje architekturalne

- **Server Components** — domyślnie serwer, Client Components tylko gdy wymagana interakcja
- **Batch Processing** — scrapery przetwarzają oferty w batchach po 100
- **Deduplikacja** — oferty deduplikowane po `sourceUrl`
- **SWR Cache** — localStorage cache z automatyczną rewalidacją

---

## 🚀 Szybki start

### Wymagania

- **Node.js** >= 22
- **PostgreSQL** >= 16
- npm lub pnpm

### Instalacja

```bash
# 1. Klonowanie repozytorium
git clone https://github.com/username/WorkFinder.git
cd WorkFinder

# 2. Instalacja zależności
npm install

# 3. Konfiguracja zmiennych środowiskowych
cp .env.example .env
# Edytuj .env — ustaw dane połączenia z bazą danych

# 4. Inicjalizacja bazy danych
npx prisma generate
npx prisma db push

# 5. Uruchomienie serwera deweloperskiego
npm run dev
```

Aplikacja dostępna pod adresem: **http://localhost:3000**

---

## ⚙️ Konfiguracja

### Zmienne środowiskowe (.env)

```env
# Połączenie z bazą danych
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/workfinder?schema=public"

# Automatyczna synchronizacja (true/false)
CRON_ENABLED=true

# Klucz API do synchronizacji (Bearer token)
SYNC_API_KEY=dev-key-123

# Klucz API Google Gemini (dla podsumowań AI)
GEMINI_API_KEY=your-gemini-api-key
```

---

## 📦 Stack technologiczny

| Warstwa | Technologia |
|---------|-------------|
| Framework | Next.js 16 (App Router) |
| Język | TypeScript 5 |
| UI | React 19 + Tailwind CSS 4 |
| Baza danych | PostgreSQL 16 |
| ORM | Prisma 7 (PrismaPg adapter) |
| Data Fetching | SWR 2 |
| Scraping | Axios, Playwright |
| AI | Google Gemini API |
| Scheduling | node-cron |
| UI Components | shadcn/ui |
| Theming | next-themes |

---

## 📁 Struktura projektu

```
WorkFinder/
├── prisma/
│   ├── schema.prisma            # Model JobOffer
│   └── migrations/
├── src/
│   ├── app/                     # Next.js App Router
│   │   ├── api/
│   │   │   ├── jobs/route.ts    # GET — lista ofert z paginacją
│   │   │   ├── stats/route.ts   # GET — statystyki
│   │   │   ├── sync/route.ts    # POST — synchronizacja (Bearer token)
│   │   │   └── summary/route.ts # POST — AI podsumowanie (SSE)
│   │   ├── layout.tsx           # Root layout
│   │   └── page.tsx             # Dashboard
│   ├── components/              # Komponenty React
│   │   ├── AiSummaryCard.tsx    # Karta AI podsumowania
│   │   ├── Filters.tsx          # Panel filtrów
│   │   ├── JobTable.tsx         # Tabela ofert (desktop + mobile)
│   │   ├── SearchBar.tsx        # Wyszukiwarka
│   │   └── DualRangeSlider.tsx  # Suwak zakresu wynagrodzenia
│   ├── scrapers/                # Scrapery portali pracy
│   │   ├── types.ts             # Interfejs Scraper
│   │   ├── index.ts             # Rejestr i orchestrator
│   │   └── *.ts                 # Scrapery (7 źródeł)
│   ├── hooks/                   # Customowe hooki (SWR)
│   └── lib/                     # Narzędzia (db, cron, utils)
├── public/
└── package.json
```

---

## 🌐 API

| Endpoint | Metoda | Opis |
|----------|--------|------|
| `/api/jobs` | GET | Lista ofert z paginacją i filtrowaniem |
| `/api/jobs/[id]` | GET | Szczegóły oferty |
| `/api/stats` | GET | Statystyki (total, bySource, todayNew, lastSync) |
| `/api/sync` | POST | Synchronizacja (wymaga Bearer token) |
| `/api/summary` | POST | AI podsumowanie (SSE streaming) |

### Przykładowe zapytanie

```bash
# Pobranie ofert z filtrowaniem
curl "http://localhost:3000/api/jobs?search=react&city=Warszawa&workMode=remote"

# Synchronizacja
curl -X POST http://localhost:3000/api/sync \
  -H "Authorization: Bearer dev-key-123"
```

---

## 🚢 Wdrożenie

### Vercel (zalecane)

```bash
npm i -g vercel
vercel login
vercel --prod
```
### Docker

```bash
docker-compose up -d
```

### VPS (PM2 + Nginx)

```bash
npm run build
pm2 start npm --name "workfinder" -- start
```

---

## 📄 Licencja

[MIT License](LICENSE)

---

<div align="center">

**WorkFinder** — agregator ofert pracy z 7 portali w jednym miejscu

</div>
