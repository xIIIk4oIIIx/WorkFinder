import { Scraper } from './types';
import { db } from '@/lib/db';
import { nofluffjobsScraper } from './nofluffjobs';
import { bulldogjobScraper } from './bulldogjob';
import { olxScraper } from './olx';
import { justjoinScraper } from './justjoin';
import { rocketjobsScraper } from './rocketjobs';
import { joobleScraper } from './jooble';
import { pracujScraper } from './pracuj';
import { aplikujScraper } from './aplikuj';
import { infopracaScraper } from './infopraca';
import { pracaPlScraper } from './praca-pl';
import { indeedScraper } from './indeed';

const scrapers: Scraper[] = [];

export function registerScraper(scraper: Scraper) {
  scrapers.push(scraper);
}

registerScraper(nofluffjobsScraper);
registerScraper(bulldogjobScraper);
registerScraper(olxScraper);
registerScraper(justjoinScraper);
registerScraper(rocketjobsScraper);
registerScraper(joobleScraper);
registerScraper(pracujScraper);
registerScraper(aplikujScraper);
registerScraper(infopracaScraper);
registerScraper(pracaPlScraper);
registerScraper(indeedScraper);

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
  const errors: string[] = [];

  for (const result of results) {
    if (result.status === 'fulfilled') {
      const jobs = result.value;
      total += jobs.length;
      const source = jobs[0]?.source;
      if (!source || jobs.length === 0) continue;

      const BATCH = 100;
      for (let i = 0; i < jobs.length; i += BATCH) {
        const batch = jobs.slice(i, i + BATCH);
        const urls = batch.map((j) => j.sourceUrl);

        const existing = await db.jobOffer.findMany({
          where: { sourceUrl: { in: urls } },
          select: { sourceUrl: true },
        });
        const existingSet = new Set(existing.map((e) => e.sourceUrl));
        const newJobs = batch.filter((j) => !existingSet.has(j.sourceUrl));

        if (newJobs.length > 0) {
          await db.jobOffer.createMany({
            data: newJobs.map((j) => ({
              source: j.source,
              externalId: j.externalId,
              sourceUrl: j.sourceUrl,
              title: j.title,
              company: j.company,
              city: j.city || null,
              region: j.region || null,
              remote: j.remote,
              workMode: j.workMode || null,
              salaryMin: j.salaryMin || null,
              salaryMax: j.salaryMax || null,
              salaryCurrency: j.salaryCurrency || 'PLN',
              technologies: j.technologies,
              description: j.description || null,
              publishedAt: j.publishedAt || null,
            })),
            skipDuplicates: true,
          });
          newCount += newJobs.length;
        }
      }
    } else {
      errors.push(String(result.reason));
    }
  }

  return { total, new: newCount, updated: total - newCount, errors };
}
