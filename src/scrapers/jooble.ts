import { Scraper, JobOfferInput } from './types';

const API_URL = 'https://jooble.org/api/';
const SEARCH_QUERIES = ['programista', 'developer', 'react developer', 'fullstack', 'backend'];

export const joobleScraper: Scraper = {
  name: 'jooble',

  async fetchJobs(): Promise<JobOfferInput[]> {
    const allJobs: JobOfferInput[] = [];
    const seenIds = new Set<string>();

    for (const query of SEARCH_QUERIES) {
      try {
        const response = await fetch(API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          body: JSON.stringify({
            keywords: query,
            location: 'Poland',
            page: '1',
          }),
          signal: AbortSignal.timeout(30000),
        });

        if (response.status === 403) {
          console.warn('jooble: Cloudflare blocked. Skipping query:', query);
          continue;
        }

        if (!response.ok) {
          console.warn(`jooble: HTTP ${response.status} for query "${query}". Skipping.`);
          continue;
        }

        const data = await response.json();
        const jobs = data.jobs ?? data.results ?? [];

        for (const item of jobs) {
          const id = item.id ?? item.uniqueId ?? `${item.title}-${item.company}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
          if (seenIds.has(id)) continue;
          seenIds.add(id);

          const salary = item.salary ?? item.salaryInfo ?? '';
          let salaryMin: number | undefined;
          let salaryMax: number | undefined;

          if (salary) {
            const nums = salary.replace(/\s/g, '').match(/(\d[\d,.]*)/g);
            if (nums && nums.length >= 2) {
              salaryMin = Math.round(parseFloat(nums[0].replace(/,/g, '')));
              salaryMax = Math.round(parseFloat(nums[1].replace(/,/g, '')));
            } else if (nums && nums.length === 1) {
              salaryMin = Math.round(parseFloat(nums[0].replace(/,/g, '')));
            }
          }

          const location = item.location ?? item.city ?? '';
          const city = location.split(',')[0]?.trim() || undefined;

          const desc = (item.snippet ?? item.description ?? '').replace(/<[^>]*>/g, '');
          const combined = `${item.title ?? ''} ${desc}`.toLowerCase();
          const isRemote = combined.includes('zdaln') || combined.includes('remote') || combined.includes('home office');

          allJobs.push({
            source: 'jooble',
            externalId: id,
            sourceUrl: item.link ?? item.url ?? item.redirectUrl ?? `https://jooble.org/desc/${id}`,
            title: item.title ?? '',
            company: item.company ?? item.companyName ?? 'Unknown',
            city,
            region: undefined,
            remote: isRemote,
            workMode: isRemote ? 'remote' : undefined,
            salaryMin,
            salaryMax,
            salaryCurrency: 'PLN',
            technologies: [],
            description: desc.substring(0, 500) || undefined,
            publishedAt: item.pubDate ?? item.datePosted ? new Date(item.pubDate ?? item.datePosted) : undefined,
          });
        }

        await new Promise((r) => setTimeout(r, 1500));
      } catch (e) {
        console.warn(`jooble: query "${query}" failed -`, e instanceof Error ? e.message : e);
      }
    }

    return allJobs;
  },
};
