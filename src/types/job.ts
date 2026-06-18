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