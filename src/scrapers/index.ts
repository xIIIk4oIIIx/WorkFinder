import { Scraper } from './types';
import { db } from '@/lib/db';
import { justjoinScraper } from './justjoin';
import { nofluffjobsScraper } from './nofluffjobs';

const scrapers: Scraper[] = [];

export function registerScraper(scraper: Scraper) {
  scrapers.push(scraper);
}

registerScraper(justjoinScraper);
registerScraper(nofluffjobsScraper);

export async function runAllScrapers(): Promise<{
  total: number;
  new: number;
  updated: number;
  errors: string[];
}> {
  const results = await Promise.allSettled(
    scrapers.map((s) => s.fetchJobs())
  );

  let total = 0;
  let newCount = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const result of results) {
    if (result.status === 'fulfilled') {
      const jobs = result.value;
      total += jobs.length;

      for (const job of jobs) {
        const existing = await db.jobOffer.findUnique({
          where: { sourceUrl: job.sourceUrl },
        });

        if (!existing) {
          await db.jobOffer.create({ data: job });
          newCount++;
        } else {
          await db.jobOffer.update({
            where: { sourceUrl: job.sourceUrl },
            data: {
              salaryMin: job.salaryMin ?? existing.salaryMin,
              salaryMax: job.salaryMax ?? existing.salaryMax,
              technologies:
                job.technologies.length > 0
                  ? job.technologies
                  : existing.technologies,
              remote: job.remote,
              workMode: job.workMode ?? existing.workMode,
            },
          });
          updated++;
        }
      }
    } else {
      errors.push(String(result.reason));
    }
  }

  return { total, new: newCount, updated, errors };
}
