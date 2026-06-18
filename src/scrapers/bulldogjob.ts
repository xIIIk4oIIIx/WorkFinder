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
