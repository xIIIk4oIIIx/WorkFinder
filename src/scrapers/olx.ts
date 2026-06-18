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
    if (!response.ok) throw new Error(`olx: HTTP ${response.status}`);
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
