import { Scraper, JobOfferInput } from './types';

const API_URL = 'https://www.pracuj.pl/api/v4/offers?offset=0&limit=40';

export const pracujScraper: Scraper = {
  name: 'pracuj',

  async fetchJobs(): Promise<JobOfferInput[]> {
    const response = await fetch(API_URL, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'application/json',
      },
    });
    if (!response.ok) throw new Error(`pracuj: HTTP ${response.status}`);
    const data = await response.json();

    return (
      data.offers?.map((item: any) => ({
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
      })) ?? []
    );
  },
};
