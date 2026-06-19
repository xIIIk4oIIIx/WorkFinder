import { Scraper, JobOfferInput } from './types';

const GRAPHQL_URL = 'https://bulldogjob.com/graphql';

const QUERY = `query searchJobs($page: Int, $perPage: Int) {
  searchJobs(page: $page, perPage: $perPage, language: pl) {
    totalCount
    nodes {
      id
      company { name }
      position
      city
      remote
      technologyTags
      experienceLevel
      employmentType
      contractB2b
      contractEmployment
      denominatedSalaryLong { money currency hidden }
    }
  }
}`;

interface BulldogJobNode {
  id: string;
  company: { name: string };
  position: string;
  city: string;
  remote: boolean;
  technologyTags: string[];
  experienceLevel: string;
  employmentType: string;
  contractB2b: boolean;
  contractEmployment: boolean;
  denominatedSalaryLong: { money: string; currency: string; hidden: boolean } | null;
}

function parseSalary(val: string | number | undefined | null): number | undefined {
  if (val == null) return undefined;
  if (typeof val === 'number') return Math.round(val);
  const nums = val.replace(/\s/g, '').match(/\d+/g);
  if (!nums || nums.length === 0) return undefined;
  return Math.round(parseInt(nums[0]));
}

function parseSalaryMax(val: string | number | undefined | null): number | undefined {
  if (val == null) return undefined;
  if (typeof val === 'number') return undefined;
  const nums = val.replace(/\s/g, '').match(/\d+/g);
  if (!nums || nums.length < 2) return undefined;
  return Math.round(parseInt(nums[1]));
}

export const bulldogjobScraper: Scraper = {
  name: 'bulldogjob',

  async fetchJobs(): Promise<JobOfferInput[]> {
    const allJobs: JobOfferInput[] = [];
    let page = 1;
    const perPage = 100;
    let hasMore = true;

    while (hasMore && page <= 5) {
      const response = await fetch(GRAPHQL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: QUERY, variables: { page, perPage } }),
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) throw new Error(`bulldogjob: HTTP ${response.status}`);
      const data = await response.json();
      const nodes: BulldogJobNode[] = data.data?.searchJobs?.nodes ?? [];

      if (nodes.length === 0) {
        hasMore = false;
        break;
      }

      for (const item of nodes) {
        allJobs.push({
          source: 'bulldogjob',
          externalId: item.id,
          sourceUrl: `https://bulldogjob.com/job-offer/${item.id}`,
          title: item.position,
          company: item.company?.name ?? 'Unknown',
          city: item.city ?? undefined,
          region: undefined,
          remote: item.remote ?? false,
          workMode: item.remote ? 'remote' : 'office',
          salaryMin: parseSalary(item.denominatedSalaryLong?.money),
          salaryMax: parseSalaryMax(item.denominatedSalaryLong?.money),
          salaryCurrency: item.denominatedSalaryLong?.currency ?? 'PLN',
          technologies: item.technologyTags ?? [],
          description: undefined,
          publishedAt: undefined,
        });
      }

      page++;
    }

    return allJobs;
  },
};
