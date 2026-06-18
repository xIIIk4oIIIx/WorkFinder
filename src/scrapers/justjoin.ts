import { Scraper, JobOfferInput } from './types';

interface JustJoinSkill {
  name: string;
}

interface JustJoinItem {
  id: string;
  title: string;
  companyName: string;
  city: string;
  region: string;
  remote: boolean;
  salaryFrom: number | null;
  salaryTo: number | null;
  salaryCurrency: string | null;
  skills: JustJoinSkill[];
  description: string;
  publishedAt: string | null;
}

const API_URL = 'https://api.justjoin.it/api/v1/listing';

export const justjoinScraper: Scraper = {
  name: 'justjoin',

  async fetchJobs(): Promise<JobOfferInput[]> {
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error(`justjoin: HTTP ${response.status}`);
    const data: JustJoinItem[] = await response.json();

    return data.map((item) => ({
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
      technologies: item.skills?.map((s) => s.name) ?? [],
      description: item.description,
      publishedAt: item.publishedAt ? new Date(item.publishedAt) : undefined,
    }));
  },
};
