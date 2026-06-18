import { Scraper } from './types';
import { db } from '@/lib/db';
import { justjoinScraper } from './justjoin';
import { nofluffjobsScraper } from './nofluffjobs';
import { bulldogjobScraper } from './bulldogjob';
import { olxScraper } from './olx';
import { pracujScraper } from './pracuj';

const scrapers: Scraper[] = [];

export function registerScraper(scraper: Scraper) {
  scrapers.push(scraper);
}

registerScraper(justjoinScraper);
registerScraper(nofluffjobsScraper);
registerScraper(bulldogjobScraper);
registerScraper(olxScraper);
registerScraper(pracujScraper);

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

      const sourceUrls = jobs.map((j) => j.sourceUrl);
      const existing = await db.jobOffer.findMany({
        where: { sourceUrl: { in: sourceUrls } },
        select: { sourceUrl: true },
      });
      const existingUrls = new Set(existing.map((e) => e.sourceUrl));

      await db.$transaction(
        jobs.map((job) =>
          db.jobOffer.upsert({
            where: { sourceUrl: job.sourceUrl },
            create: {
              source: job.source,
              externalId: job.externalId,
              sourceUrl: job.sourceUrl,
              title: job.title,
              company: job.company,
              city: job.city,
              region: job.region,
              remote: job.remote,
              workMode: job.workMode,
              salaryMin: job.salaryMin,
              salaryMax: job.salaryMax,
              salaryCurrency: job.salaryCurrency,
              technologies: job.technologies,
              description: job.description,
              publishedAt: job.publishedAt,
            },
            update: {
              title: job.title,
              company: job.company,
              city: job.city,
              region: job.region,
              remote: job.remote,
              workMode: job.workMode,
              salaryMin: job.salaryMin,
              salaryMax: job.salaryMax,
              salaryCurrency: job.salaryCurrency,
              technologies: job.technologies.length > 0 ? job.technologies : undefined,
              description: job.description,
              publishedAt: job.publishedAt,
            },
          })
        )
      );

      for (const job of jobs) {
        if (existingUrls.has(job.sourceUrl)) updated++;
        else newCount++;
      }
    } else {
      errors.push(String(result.reason));
    }
  }

  return { total, new: newCount, updated, errors };
}
