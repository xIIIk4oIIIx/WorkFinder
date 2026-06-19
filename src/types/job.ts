export interface JobSource {
  id: string;
  source: string;
  sourceUrl: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  publishedAt: string | null;
  fetchedAt: string;
}

export interface Job {
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

export interface GroupedJob {
  id: string;
  title: string;
  company: string;
  city: string | null;
  region: string | null;
  workMode: string | null;
  remote: boolean;
  technologies: string[];
  description: string | null;
  publishedAt: string | null;
  sourceCount: number;
  sources: JobSource[];
}
