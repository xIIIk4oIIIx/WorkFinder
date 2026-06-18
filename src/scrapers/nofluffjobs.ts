import { Scraper, JobOfferInput } from './types';

const API_URL = 'https://api.nofluffjobs.com/v1/public/posting/search?pageSize=100';

export const nofluffjobsScraper: Scraper = {
  name: 'nofluffjobs',

  async fetchJobs(): Promise<JobOfferInput[]> {
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error(`nofluffjobs: HTTP ${response.status}`);
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
