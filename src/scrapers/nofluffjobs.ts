import { Scraper, JobOfferInput } from './types';

const API_URL = 'https://nofluffjobs.com/api/posting?limit=100';

export const nofluffjobsScraper: Scraper = {
  name: 'nofluffjobs',

  async fetchJobs(): Promise<JobOfferInput[]> {
    const response = await fetch(API_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`nofluffjobs: HTTP ${response.status}`);
    const data = await response.json();

    return data.postings?.map((item: any) => ({
      source: 'nofluffjobs',
      externalId: item.id,
      sourceUrl: `https://nofluffjobs.com/pl/job/${item.url ?? item.id}`,
      title: item.title,
      company: item.name ?? 'Unknown',
      city: item.location?.places?.[0]?.city ?? undefined,
      region: item.location?.places?.[0]?.region ?? undefined,
      remote: item.location?.fullyRemote ?? false,
      workMode: item.location?.fullyRemote ? 'remote' : 'office',
      salaryMin: item.salary?.from ?? undefined,
      salaryMax: item.salary?.to ?? undefined,
      salaryCurrency: item.salary?.currency ?? 'PLN',
      technologies: item.tiles?.values
        ?.filter((t: any) => t.type === 'requirement')
        .map((t: any) => t.value) ?? [],
      description: undefined,
      publishedAt: item.posted ? new Date(item.posted) : undefined,
    })) ?? [];
  },
};
