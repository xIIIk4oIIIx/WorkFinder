# Job Aggregator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a job offer aggregator web application that fetches offers from multiple sources and presents them with advanced filtering.

**Architecture:** Next.js 14 App Router with Prisma ORM (PostgreSQL), Tailwind CSS for styling, node-cron for hourly background scraping. Modular scraper architecture with shared interface.

**Tech Stack:** Next.js, Tailwind CSS, Prisma, PostgreSQL, node-cron, node-fetch

---

### Task 1: Project Scaffolding

**Covers:** [S2, S3]

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.js`
- Create: `tailwind.config.ts`
- Create: `postcss.config.js`
- Create: `.env`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/globals.css`

- [ ] **Step 1: Initialize Next.js project**

```bash
npx create-next-app@latest workfinder --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd workfinder
```

- [ ] **Step 2: Install dependencies**

```bash
npm install prisma @prisma/client node-cron axios
npm install -D @types/node-cron
```

- [ ] **Step 3: Initialize Prisma**

```bash
npx prisma init
```

- [ ] **Step 4: Configure .env**

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/workfinder?schema=public"
CRON_ENABLED=true
```

- [ ] **Step 5: Verify project runs**

```bash
npm run dev
```

Expected: Server starts on http://localhost:3000

- [ ] **Step 6: Commit**

```bash
git init
git add .
git commit -m "chore: scaffold Next.js project with Prisma and Tailwind"
```

---

### Task 2: Database Schema

**Covers:** [S4]

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/lib/db.ts`

- [ ] **Step 1: Write Prisma schema**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

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

- [ ] **Step 2: Create Prisma client singleton**

```typescript
// src/lib/db.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
```

- [ ] **Step 3: Run migration**

```bash
npx prisma migrate dev --name init
```

Expected: Migration created, database updated

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma src/lib/db.ts prisma/migrations
git commit -m "feat: add Prisma schema for JobOffer model"
```

---

### Task 3: Scraper Types and Registry

**Covers:** [S5, S6]

**Files:**
- Create: `src/scrapers/types.ts`
- Create: `src/scrapers/index.ts`

- [ ] **Step 1: Define shared types**

```typescript
// src/scrapers/types.ts
export interface Scraper {
  name: string;
  fetchJobs(): Promise<JobOfferInput[]>;
}

export interface JobOfferInput {
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

- [ ] **Step 2: Create scraper registry and runner**

```typescript
// src/scrapers/index.ts
import { Scraper, JobOfferInput } from './types';
import { db } from '@/lib/db';

const scrapers: Scraper[] = [];

export function registerScraper(scraper: Scraper) {
  scrapers.push(scraper);
}

export async function runAllScrapers(): Promise<{
  total: number;
  new: number;
  updated: number;
  errors: string[];
}> {
  const results = await Promise.allSettled(
    scrapers.map((s) => s.fetchJobs())
  );

  let total = 0;
  let newCount = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const result of results) {
    if (result.status === 'fulfilled') {
      const jobs = result.value;
      total += jobs.length;

      for (const job of jobs) {
        const existing = await db.jobOffer.findUnique({
          where: { sourceUrl: job.sourceUrl },
        });

        if (!existing) {
          await db.jobOffer.create({ data: job });
          newCount++;
        } else {
          await db.jobOffer.update({
            where: { sourceUrl: job.sourceUrl },
            data: {
              salaryMin: job.salaryMin ?? existing.salaryMin,
              salaryMax: job.salaryMax ?? existing.salaryMax,
              technologies: job.technologies.length > 0 ? job.technologies : existing.technologies,
              remote: job.remote,
              workMode: job.workMode ?? existing.workMode,
            },
          });
          updated++;
        }
      }
    } else {
      errors.push(String(result.reason));
    }
  }

  return { total, new: newCount, updated, errors };
}
```

- [ ] **Step 3: Commit**

```bash
git add src/scrapers/types.ts src/scrapers/index.ts
git commit -m "feat: add scraper types and registry with deduplication logic"
```

---

### Task 4: JustJoin.it Scraper

**Covers:** [S5, S6]

**Files:**
- Create: `src/scrapers/justjoin.ts`

- [ ] **Step 1: Implement JustJoin.it scraper**

```typescript
// src/scrapers/justjoin.ts
import { Scraper, JobOfferInput } from './types';

const API_URL = 'https://api.justjoin.it/api/v1/listing';

export const justjoinScraper: Scraper = {
  name: 'justjoin',

  async fetchJobs(): Promise<JobOfferInput[]> {
    const response = await fetch(API_URL);
    const data = await response.json();

    return data.map((item: any) => ({
      source: 'justjoin',
      externalId: item.id,
      sourceUrl: `https://justjoin.it/offers/${item.id}`,
      title: item.title,
      company: item.companyName,
      city: item.city,
      region: item.region,
      remote: item.remote ?? false,
      workMode: item.remote ? 'remote' : 'office',
      salaryMin: item.salaryFrom ?? undefined,
      salaryMax: item.salaryTo ?? undefined,
      salaryCurrency: item.salaryCurrency ?? 'PLN',
      technologies: item.skills?.map((s: any) => s.name) ?? [],
      description: item.description,
      publishedAt: item.publishedAt ? new Date(item.publishedAt) : undefined,
    }));
  },
};
```

- [ ] **Step 2: Register scraper in index**

Add to `src/scrapers/index.ts`:
```typescript
import { justjoinScraper } from './justjoin';
registerScraper(justjoinScraper);
```

- [ ] **Step 3: Commit**

```bash
git add src/scrapers/justjoin.ts src/scrapers/index.ts
git commit -m "feat: add JustJoin.it scraper"
```

---

### Task 5: NoFluffJobs Scraper

**Covers:** [S5, S6]

**Files:**
- Create: `src/scrapers/nofluffjobs.ts`

- [ ] **Step 1: Implement NoFluffJobs scraper**

```typescript
// src/scrapers/nofluffjobs.ts
import { Scraper, JobOfferInput } from './types';

const API_URL = 'https://api.nofluffjobs.com/v1/public/posting/search?pageSize=100';

export const nofluffjobsScraper: Scraper = {
  name: 'nofluffjobs',

  async fetchJobs(): Promise<JobOfferInput[]> {
    const response = await fetch(API_URL);
    const data = await response.json();

    return data.postings?.map((item: any) => ({
      source: 'nofluffjobs',
      externalId: item.id,
      sourceUrl: `https://nofluffjobs.com/pl/posting/${item.id}`,
      title: item.title,
      company: item.companyName,
      city: item.locations?.[0]?.city ?? undefined,
      region: item.locations?.[0]?.region ?? undefined,
      remote: item.remote ?? false,
      workMode: item.remote ? 'remote' : 'office',
      salaryMin: item.salaryFrom ?? undefined,
      salaryMax: item.salaryTo ?? undefined,
      salaryCurrency: item.salaryCurrency ?? 'PLN',
      technologies: item.skills?.map((s: any) => s.name) ?? [],
      description: item.description,
      publishedAt: item.publishedAt ? new Date(item.publishedAt) : undefined,
    })) ?? [];
  },
};
```

- [ ] **Step 2: Register scraper**

Add to `src/scrapers/index.ts`:
```typescript
import { nofluffjobsScraper } from './nofluffjobs';
registerScraper(nofluffjobsScraper);
```

- [ ] **Step 3: Commit**

```bash
git add src/scrapers/nofluffjobs.ts src/scrapers/index.ts
git commit -m "feat: add NoFluffJobs scraper"
```

---

### Task 6: BulldogJob Scraper

**Covers:** [S5, S6]

**Files:**
- Create: `src/scrapers/bulldogjob.ts`

- [ ] **Step 1: Implement BulldogJob scraper**

```typescript
// src/scrapers/bulldogjob.ts
import { Scraper, JobOfferInput } from './types';

const API_URL = 'https://api.bulldogjob.co/v1/jobs';

export const bulldogjobScraper: Scraper = {
  name: 'bulldogjob',

  async fetchJobs(): Promise<JobOfferInput[]> {
    const response = await fetch(API_URL);
    const data = await response.json();

    return data.jobs?.map((item: any) => ({
      source: 'bulldogjob',
      externalId: item.id,
      sourceUrl: `https://bulldogjob.co/jobs/${item.id}`,
      title: item.title,
      company: item.companyName,
      city: item.location?.city ?? undefined,
      region: item.location?.region ?? undefined,
      remote: item.remote ?? false,
      workMode: item.workType ?? 'office',
      salaryMin: item.salaryFrom ?? undefined,
      salaryMax: item.salaryTo ?? undefined,
      salaryCurrency: item.salaryCurrency ?? 'PLN',
      technologies: item.skills?.map((s: any) => s.name) ?? [],
      description: item.description,
      publishedAt: item.publishedAt ? new Date(item.publishedAt) : undefined,
    })) ?? [];
  },
};
```

- [ ] **Step 2: Register scraper**

Add to `src/scrapers/index.ts`:
```typescript
import { bulldogjobScraper } from './bulldogjob';
registerScraper(bulldogjobScraper);
```

- [ ] **Step 3: Commit**

```bash
git add src/scrapers/bulldogjob.ts src/scrapers/index.ts
git commit -m "feat: add BulldogJob scraper"
```

---

### Task 7: OLX Scraper

**Covers:** [S5, S6]

**Files:**
- Create: `src/scrapers/olx.ts`

- [ ] **Step 1: Implement OLX scraper**

```typescript
// src/scrapers/olx.ts
import { Scraper, JobOfferInput } from './types';

const BASE_URL = 'https://www.olx.pl/api/v1/offers/?category_id=216&offset=0&limit=40';

export const olxScraper: Scraper = {
  name: 'olx',

  async fetchJobs(): Promise<JobOfferInput[]> {
    const response = await fetch(BASE_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    const data = await response.json();

    return data.data?.map((item: any) => ({
      source: 'olx',
      externalId: item.id,
      sourceUrl: item.url ?? `https://www.olx.pl/oferty/${item.id}`,
      title: item.title,
      company: item.parameters?.find((p: any) => p.key === 'company_name')?.normalizedValue?.[0] ?? 'Unknown',
      city: item.location?.city?.name ?? undefined,
      region: item.location?.region?.name ?? undefined,
      remote: false,
      workMode: item.parameters?.find((p: any) => p.key === 'work_type')?.normalizedValue?.[0] ?? 'office',
      salaryMin: undefined,
      salaryMax: undefined,
      salaryCurrency: 'PLN',
      technologies: [],
      description: item.description,
      publishedAt: item.created_time ? new Date(item.created_time) : undefined,
    })) ?? [];
  },
};
```

- [ ] **Step 2: Register scraper**

Add to `src/scrapers/index.ts`:
```typescript
import { olxScraper } from './olx';
registerScraper(olxScraper);
```

- [ ] **Step 3: Commit**

```bash
git add src/scrapers/olx.ts src/scrapers/index.ts
git commit -m "feat: add OLX scraper"
```

---

### Task 8: Pracuj.pl Scraper

**Covers:** [S5, S6]

**Files:**
- Create: `src/scrapers/pracuj.ts`

- [ ] **Step 1: Implement Pracuj.pl scraper**

```typescript
// src/scrapers/pracuj.ts
import { Scraper, JobOfferInput } from './types';

const API_URL = 'https://www.pracuj.pl/api/v4/offers?offset=0&limit=40';

export const pracujScraper: Scraper = {
  name: 'pracuj',

  async fetchJobs(): Promise<JobOfferInput[]> {
    const response = await fetch(API_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    });
    const data = await response.json();

    return data.offers?.map((item: any) => ({
      source: 'pracuj',
      externalId: String(item.id),
      sourceUrl: `https://www.pracuj.pl/praca/${item.id}`,
      title: item.title,
      company: item.employer?.name ?? 'Unknown',
      city: item.location?.city?.name ?? undefined,
      region: item.location?.region?.name ?? undefined,
      remote: item.remote ?? false,
      workMode: item.workTypes?.[0] ?? 'office',
      salaryMin: item.salary?.from ?? undefined,
      salaryMax: item.salary?.to ?? undefined,
      salaryCurrency: item.salary?.currency ?? 'PLN',
      technologies: item.skills?.map((s: any) => s.name) ?? [],
      description: item.description,
      publishedAt: item.publishedAt ? new Date(item.publishedAt) : undefined,
    })) ?? [];
  },
};
```

- [ ] **Step 2: Register scraper**

Add to `src/scrapers/index.ts`:
```typescript
import { pracujScraper } from './pracuj';
registerScraper(pracujScraper);
```

- [ ] **Step 3: Commit**

```bash
git add src/scrapers/pracuj.ts src/scrapers/index.ts
git commit -m "feat: add Pracuj.pl scraper"
```

---

### Task 9: Cron Job Scheduler

**Covers:** [S8]

**Files:**
- Create: `src/lib/cron.ts`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Implement cron scheduler**

```typescript
// src/lib/cron.ts
import cron from 'node-cron';
import { runAllScrapers } from '@/scrapers';

let isRunning = false;

export function startCronJob() {
  if (process.env.CRON_ENABLED !== 'true') {
    console.log('[Cron] Disabled via CRON_ENABLED env var');
    return;
  }

  cron.schedule('0 * * * *', async () => {
    if (isRunning) {
      console.log('[Cron] Previous job still running, skipping');
      return;
    }

    isRunning = true;
    console.log('[Cron] Starting sync...');

    try {
      const result = await runAllScrapers();
      console.log(`[Cron] Sync complete: ${result.total} total, ${result.new} new, ${result.updated} updated`);
      if (result.errors.length > 0) {
        console.log(`[Cron] Errors: ${result.errors.join(', ')}`);
      }
    } catch (error) {
      console.error('[Cron] Sync failed:', error);
    } finally {
      isRunning = false;
    }
  });

  console.log('[Cron] Scheduled hourly sync');
}
```

- [ ] **Step 2: Start cron on app boot**

```typescript
// src/app/layout.tsx
import { startCron } from '@/lib/cron';

startCron();

export const metadata = {
  title: 'WorkFinder - Job Aggregator',
  description: 'Aggregate job offers from multiple sources',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/cron.ts src/app/layout.tsx
git commit -m "feat: add hourly cron job for scraping"
```

---

### Task 10: API Routes

**Covers:** [S8]

**Files:**
- Create: `src/app/api/jobs/route.ts`
- Create: `src/app/api/jobs/[id]/route.ts`
- Create: `src/app/api/sync/route.ts`
- Create: `src/app/api/stats/route.ts`

- [ ] **Step 1: GET /api/jobs — list with filters**

```typescript
// src/app/api/jobs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = parseInt(searchParams.get('limit') ?? '25');
  const search = searchParams.get('search') ?? '';
  const city = searchParams.get('city') ?? '';
  const technology = searchParams.get('technology') ?? '';
  const workMode = searchParams.get('workMode') ?? '';
  const salaryMin = searchParams.get('salaryMin') ? parseInt(searchParams.get('salaryMin')!) : undefined;
  const salaryMax = searchParams.get('salaryMax') ? parseInt(searchParams.get('salaryMax')!) : undefined;
  const company = searchParams.get('company') ?? '';
  const publishedAfter = searchParams.get('publishedAfter') ?? '';
  const sort = searchParams.get('sort') ?? 'createdAt';
  const order = searchParams.get('order') ?? 'desc';

  const where: any = {};

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { company: { contains: search, mode: 'insensitive' } },
      { technologies: { has: search } },
    ];
  }

  if (city) where.city = { contains: city, mode: 'insensitive' };
  if (technology) where.technologies = { has: technology };
  if (workMode) where.workMode = workMode;
  if (salaryMin) where.salaryMin = { gte: salaryMin };
  if (salaryMax) where.salaryMax = { lte: salaryMax };
  if (company) where.company = { contains: company, mode: 'insensitive' };
  if (publishedAfter) where.publishedAt = { gte: new Date(publishedAfter) };

  const [jobs, total] = await Promise.all([
    db.jobOffer.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { [sort]: order },
    }),
    db.jobOffer.count({ where }),
  ]);

  return NextResponse.json({
    jobs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
```

- [ ] **Step 2: GET /api/jobs/[id] — single offer**

```typescript
// src/app/api/jobs/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const job = await db.jobOffer.findUnique({
    where: { id: params.id },
  });

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  return NextResponse.json(job);
}
```

- [ ] **Step 3: POST /api/sync — manual sync trigger**

```typescript
// src/app/api/sync/route.ts
import { NextResponse } from 'next/server';
import { runAllScrapers } from '@/scrapers';

export async function POST() {
  const result = await runAllScrapers();
  return NextResponse.json(result);
}
```

- [ ] **Step 4: GET /api/stats — statistics**

```typescript
// src/app/api/stats/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const [total, bySource, latestFetched] = await Promise.all([
    db.jobOffer.count(),
    db.jobOffer.groupBy({ by: ['source'], _count: true }),
    db.jobOffer.findFirst({ orderBy: { fetchedAt: 'desc' }, select: { fetchedAt: true } }),
  ]);

  return NextResponse.json({
    total,
    bySource: bySource.map((s) => ({ source: s.source, count: s._count })),
    lastSync: latestFetched?.fetchedAt ?? null,
  });
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/
git commit -m "feat: add API routes for jobs, sync, and stats"
```

---

### Task 11: UI Components — Filters

**Covers:** [S7]

**Files:**
- Create: `src/components/Filters.tsx`
- Create: `src/components/SearchBar.tsx`

- [ ] **Step 1: Implement SearchBar component**

```typescript
// src/components/SearchBar.tsx
'use client';

import { useState } from 'react';

interface SearchBarProps {
  onSearch: (query: string) => void;
}

export function SearchBar({ onSearch }: SearchBarProps) {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query);
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Szukaj ofert pracy..."
        className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        type="submit"
        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        Szukaj
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Implement Filters component**

```typescript
// src/components/Filters.tsx
'use client';

import { useState } from 'react';

interface FiltersProps {
  onFilter: (filters: FilterState) => void;
}

export interface FilterState {
  city: string;
  technology: string;
  workMode: string;
  salaryMin: string;
  salaryMax: string;
  company: string;
  publishedAfter: string;
}

export function Filters({ onFilter }: FiltersProps) {
  const [filters, setFilters] = useState<FilterState>({
    city: '',
    technology: '',
    workMode: '',
    salaryMin: '',
    salaryMax: '',
    company: '',
    publishedAfter: '',
  });

  const handleChange = (key: keyof FilterState, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilter(newFilters);
  };

  return (
    <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
      <h3 className="font-semibold text-lg">Filtry</h3>

      <div>
        <label className="block text-sm font-medium mb-1">Miasto</label>
        <input
          type="text"
          value={filters.city}
          onChange={(e) => handleChange('city', e.target.value)}
          placeholder="np. Warszawa"
          className="w-full px-3 py-2 border rounded"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Technologia</label>
        <input
          type="text"
          value={filters.technology}
          onChange={(e) => handleChange('technology', e.target.value)}
          placeholder="np. React"
          className="w-full px-3 py-2 border rounded"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Tryb pracy</label>
        <select
          value={filters.workMode}
          onChange={(e) => handleChange('workMode', e.target.value)}
          className="w-full px-3 py-2 border rounded"
        >
          <option value="">Wszystkie</option>
          <option value="remote">Zdalnie</option>
          <option value="office">Stacjonarnie</option>
          <option value="hybrid">Hybrydowo</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Zarobki (min-max)</label>
        <div className="flex gap-2">
          <input
            type="number"
            value={filters.salaryMin}
            onChange={(e) => handleChange('salaryMin', e.target.value)}
            placeholder="Min"
            className="w-1/2 px-3 py-2 border rounded"
          />
          <input
            type="number"
            value={filters.salaryMax}
            onChange={(e) => handleChange('salaryMax', e.target.value)}
            placeholder="Max"
            className="w-1/2 px-3 py-2 border rounded"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Firma</label>
        <input
          type="text"
          value={filters.company}
          onChange={(e) => handleChange('company', e.target.value)}
          placeholder="np. mBank"
          className="w-full px-3 py-2 border rounded"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Data publikacji</label>
        <select
          value={filters.publishedAfter}
          onChange={(e) => handleChange('publishedAfter', e.target.value)}
          className="w-full px-3 py-2 border rounded"
        >
          <option value="">Wszystkie</option>
          <option value={new Date(Date.now() - 86400000).toISOString()}>Ostatnie 24h</option>
          <option value={new Date(Date.now() - 604800000).toISOString()}>Ostatni tydzień</option>
          <option value={new Date(Date.now() - 2592000000).toISOString()}>Ostatni miesiąc</option>
        </select>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Filters.tsx src/components/SearchBar.tsx
git commit -m "feat: add Filters and SearchBar components"
```

---

### Task 12: UI Components — Job Table

**Covers:** [S7]

**Files:**
- Create: `src/components/JobTable.tsx`

- [ ] **Step 1: Implement JobTable component**

```typescript
// src/components/JobTable.tsx
'use client';

interface Job {
  id: string;
  title: string;
  company: string;
  city: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  technologies: string[];
  workMode: string | null;
  source: string;
  sourceUrl: string;
  publishedAt: string | null;
}

interface JobTableProps {
  jobs: Job[];
  total: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function JobTable({ jobs, total, page, totalPages, onPageChange }: JobTableProps) {
  const formatSalary = (min: number | null, max: number | null, currency: string | null) => {
    if (!min && !max) return 'Brak danych';
    const fmt = (n: number) => n.toLocaleString('pl-PL');
    if (min && max) return `${fmt(min)} - ${fmt(max)} ${currency ?? 'PLN'}`;
    if (min) return `od ${fmt(min)} ${currency ?? 'PLN'}`;
    return `do ${fmt(max)} ${currency ?? 'PLN'}`;
  };

  const workModeLabel = (mode: string | null) => {
    const labels: Record<string, string> = { remote: 'Zdalnie', office: 'Stacjonarnie', hybrid: 'Hybrydowo' };
    return labels[mode ?? ''] ?? mode ?? 'Nieokreślony';
  };

  return (
    <div>
      <div className="mb-2 text-sm text-gray-600">Łącznie: {total} ofert</div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-3 text-left">Firma</th>
              <th className="p-3 text-left">Tytuł</th>
              <th className="p-3 text-left">Lokalizacja</th>
              <th className="p-3 text-left">Zarobki</th>
              <th className="p-3 text-left">Technologie</th>
              <th className="p-3 text-left">Tryb</th>
              <th className="p-3 text-left">Źródło</th>
              <th className="p-3 text-left">Data</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id} className="border-b hover:bg-gray-50">
                <td className="p-3 font-medium">{job.company}</td>
                <td className="p-3">
                  <a href={job.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    {job.title}
                  </a>
                </td>
                <td className="p-3">{job.city ?? '—'}</td>
                <td className="p-3">{formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency)}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {job.technologies.slice(0, 3).map((tech) => (
                      <span key={tech} className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">
                        {tech}
                      </span>
                    ))}
                    {job.technologies.length > 3 && (
                      <span className="text-xs text-gray-500">+{job.technologies.length - 3}</span>
                    )}
                  </div>
                </td>
                <td className="p-3">{workModeLabel(job.workMode)}</td>
                <td className="p-3 text-sm text-gray-500">{job.source}</td>
                <td className="p-3 text-sm text-gray-500">
                  {job.publishedAt ? new Date(job.publishedAt).toLocaleDateString('pl-PL') : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Poprzednia
          </button>
          <span className="px-3 py-1">
            Strona {page} z {totalPages}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Następna
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/JobTable.tsx
git commit -m "feat: add JobTable component with pagination"
```

---

### Task 13: Main Page Integration

**Covers:** [S7]

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Implement main page with data fetching**

```typescript
// src/app/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { SearchBar } from '@/components/SearchBar';
import { Filters, FilterState } from '@/components/Filters';
import { JobTable } from '@/components/JobTable';

interface Job {
  id: string;
  title: string;
  company: string;
  city: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  technologies: string[];
  workMode: string | null;
  source: string;
  sourceUrl: string;
  publishedAt: string | null;
}

export default function Home() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<FilterState>({
    city: '',
    technology: '',
    workMode: '',
    salaryMin: '',
    salaryMax: '',
    company: '',
    publishedAfter: '',
  });
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', '25');
    if (search) params.set('search', search);
    if (filters.city) params.set('city', filters.city);
    if (filters.technology) params.set('technology', filters.technology);
    if (filters.workMode) params.set('workMode', filters.workMode);
    if (filters.salaryMin) params.set('salaryMin', filters.salaryMin);
    if (filters.salaryMax) params.set('salaryMax', filters.salaryMax);
    if (filters.company) params.set('company', filters.company);
    if (filters.publishedAfter) params.set('publishedAfter', filters.publishedAfter);

    const res = await fetch(`/api/jobs?${params.toString()}`);
    const data = await res.json();
    setJobs(data.jobs);
    setTotal(data.pagination.total);
    setTotalPages(data.pagination.totalPages);
    setLoading(false);
  }, [page, search, filters]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const handleSearch = (query: string) => {
    setSearch(query);
    setPage(1);
  };

  const handleFilter = (newFilters: FilterState) => {
    setFilters(newFilters);
    setPage(1);
  };

  const handleSync = async () => {
    setSyncing(true);
    await fetch('/api/sync', { method: 'POST' });
    await fetchJobs();
    setSyncing(false);
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-gray-900 text-white p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold">WorkFinder</h1>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {syncing ? 'Odświeżanie...' : 'Odśwież dane'}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4">
        <div className="mb-4">
          <SearchBar onSearch={handleSearch} />
        </div>

        <div className="flex gap-6">
          <aside className="w-64 flex-shrink-0">
            <Filters onFilter={handleFilter} />
          </aside>

          <section className="flex-1">
            {loading ? (
              <div className="text-center py-8">Ładowanie...</div>
            ) : (
              <JobTable
                jobs={jobs}
                total={total}
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: integrate main page with search, filters, and job table"
```

---

### Task 14: Styling and Polish

**Covers:** [S7]

**Files:**
- Modify: `src/app/globals.css`
- Modify: `tailwind.config.ts`

- [ ] **Step 1: Add custom styles**

```css
/* src/app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/globals.css
git commit -m "style: add custom CSS for WorkFinder"
```

---

### Task 15: Final Verification

**Covers:** [S1-S9]

- [ ] **Step 1: Run database migration**

```bash
npx prisma migrate dev
```

- [ ] **Step 2: Start development server**

```bash
npm run dev
```

- [ ] **Step 3: Test manual sync**

```bash
curl -X POST http://localhost:3000/api/sync
```

- [ ] **Step 4: Test job listing**

```bash
curl http://localhost:3000/api/jobs
```

- [ ] **Step 5: Test filters**

```bash
curl "http://localhost:3000/api/jobs?city=Warszawa&technology=React"
```

- [ ] **Step 6: Verify UI in browser**

Open http://localhost:3000 and verify:
- Search bar works
- Filters apply correctly
- Table shows offers
- Pagination works
- Sync button triggers refresh

- [ ] **Step 7: Final commit**

```bash
git add .
git commit -m "feat: complete job aggregator application"
```
