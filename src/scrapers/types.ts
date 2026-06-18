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
