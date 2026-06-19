import { Scraper, JobOfferInput } from './types';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml',
  'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7',
};

export const justjoinScraper: Scraper = {
  name: 'justjoin',

  async fetchJobs(): Promise<JobOfferInput[]> {
    const allJobs: JobOfferInput[] = [];

    try {
      const response = await fetch('https://justjoin.it', {
        headers: HEADERS,
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) throw new Error(`justjoin: HTTP ${response.status}`);
      const html = await response.text();

      const jobPattern =
        /\\"body\\":\\"([^\\]+)\\",\\"categoryId\\":(\d+),\\"city\\":\\"([^\\]*)\\",\\"companyLogoThumbUrl\\":\\"[^"]*\\"[^"]*,\\"companyName\\":\\"([^\\]+)\\"/g;

      let match;
      while ((match = jobPattern.exec(html)) !== null) {
        const title = match[1];
        const city = match[3] || undefined;
        const company = match[4];

        const idx = match.index;
        const chunk = html.substring(idx, idx + 3000);

        const slugMatch = chunk.match(/\\"slug\\":\\"([^\\]+)\\"/);
        const slug = slugMatch?.[1] ?? `${company}-${title}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');

        const remoteMatch = chunk.match(/\\"workplaceType\\":\\"([^\\]+)\\"/);
        const workplaceType = remoteMatch?.[1] ?? 'office';
        const remote = workplaceType === 'remote';

        const expMatch = chunk.match(/\\"experienceLevel\\":\\"([^\\]+)\\"/);

        const pubMatch = chunk.match(/\\"publishedAt\\":\\"([^\\]+)\\"/);

        const plnSalary = chunk.match(
          /\\"from\\":(\d+\.?\d*),\\"fromPerUnit\\":\d+\.?\d*,\\"to\\":(\d+\.?\d*),\\"toPerUnit\\":\d+\.?\d*,\\"currency\\":\\"PLN\\"/
        );

        const skillsMatch = chunk.match(/\\"requiredSkills\\":\[([^\]]*)\]/);
        const technologies: string[] = [];
        if (skillsMatch?.[1]) {
          const skillPattern = /\\"([^\\]+)\\"/g;
          let sm;
          while ((sm = skillPattern.exec(skillsMatch[1])) !== null) {
            technologies.push(sm[1]);
          }
        }

        allJobs.push({
          source: 'justjoin',
          externalId: slug,
          sourceUrl: `https://justjoin.it/offers/${slug}`,
          title,
          company,
          city,
          region: undefined,
          remote,
          workMode: workplaceType === 'remote' ? 'remote' : workplaceType === 'hybrid' ? 'hybrid' : 'office',
          salaryMin: plnSalary ? Math.round(parseFloat(plnSalary[1])) : undefined,
          salaryMax: plnSalary ? Math.round(parseFloat(plnSalary[2])) : undefined,
          salaryCurrency: 'PLN',
          technologies,
          description: undefined,
          publishedAt: pubMatch?.[1] ? new Date(pubMatch[1]) : undefined,
        });
      }
    } catch {
      // JustJoin scraping may fail
    }

    return allJobs;
  },
};
