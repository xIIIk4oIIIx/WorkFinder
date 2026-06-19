import { Scraper, JobOfferInput } from './types';

const ADZUNA_APP_ID = process.env.ADZUNA_APP_ID ?? '';
const ADZUNA_APP_KEY = process.env.ADZUNA_APP_KEY ?? '';
const BASE_URL = 'https://api.adzuna.com/v1/api/jobs/pl/search';
const SEARCH_QUERIES = ['programista', 'developer', 'react', 'fullstack', 'backend'];

export const adzunaScraper: Scraper = {
  name: 'adzuna',

  async fetchJobs(): Promise<JobOfferInput[]> {
    if (!ADZUNA_APP_ID || !ADZUNA_APP_KEY) {
      console.warn('adzuna: ADZUNA_APP_ID and ADZUNA_APP_KEY not set. Skipping.');
      return [];
    }

    const allJobs: JobOfferInput[] = [];
    const seenIds = new Set<string>();

    for (const query of SEARCH_QUERIES) {
      try {
        const params = new URLSearchParams({
          app_id: ADZUNA_APP_ID,
          app_key: ADZUNA_APP_KEY,
          results_per_page: '50',
          what: query,
          'content-type': 'application/json',
        });

        const response = await fetch(`${BASE_URL}/1?${params.toString()}`, {
          signal: AbortSignal.timeout(30000),
        });

        if (!response.ok) {
          console.warn(`adzuna: HTTP ${response.status} for query "${query}". Skipping.`);
          continue;
        }

        const data = await response.json();
        const results = data.results ?? [];

        for (const item of results) {
          const id = String(item.id ?? '');
          if (!id || seenIds.has(id)) continue;
          seenIds.add(id);

          const location = item.location ?? {};
          const area: string[] = location.area ?? [];
          const city = area[area.length - 1] || location.display_name?.split(',')[0] || undefined;

          const desc = (item.description ?? '').replace(/<[^>]*>/g, '');
          const combined = `${item.title ?? ''} ${desc}`.toLowerCase();
          const isRemote = combined.includes('remote') || combined.includes('zdaln');

          allJobs.push({
            source: 'adzuna',
            externalId: id,
            sourceUrl: item.redirect_url ?? `https://www.adzuna.pl/offer/${id}`,
            title: item.title ?? '',
            company: item.company?.display_name ?? 'Unknown',
            city,
            region: area.length > 1 ? area[1] : undefined,
            remote: isRemote,
            workMode: isRemote ? 'remote' : undefined,
            salaryMin: item.salary_min ? Math.round(item.salary_min) : undefined,
            salaryMax: item.salary_max ? Math.round(item.salary_max) : undefined,
            salaryCurrency: 'PLN',
            technologies: [],
            description: desc.substring(0, 500) || undefined,
            publishedAt: item.created ? new Date(item.created) : undefined,
          });
        }

        await new Promise((r) => setTimeout(r, 1500));
      } catch (e) {
        console.warn(`adzuna: query "${query}" failed -`, e instanceof Error ? e.message : e);
      }
    }

    return allJobs;
  },
};
