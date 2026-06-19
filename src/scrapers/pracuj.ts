import { Scraper, JobOfferInput } from './types';
import { chromium, Browser } from 'playwright';

const SEARCH_URLS = [
  'https://it.pracuj.pl/praca/it',
  'https://it.pracuj.pl/praca/it?kw=react',
  'https://it.pracuj.pl/praca/it?kw=node',
  'https://it.pracuj.pl/praca/it?kw=python',
  'https://it.pracuj.pl/praca/it?kw=java',
  'https://it.pracuj.pl/praca/it?kw=fullstack',
  'https://it.pracuj.pl/praca/it?kw=devops',
  'https://it.pracuj.pl/praca/it?kw=frontend',
  'https://it.pracuj.pl/praca/it?kw=backend',
];

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
  return browser;
}

async function scrapePage(url: string): Promise<JobOfferInput[]> {
  const b = await getBrowser();
  const context = await b.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'pl-PL',
  });
  const page = await context.newPage();
  const jobs: JobOfferInput[] = [];

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    const jobCards = await page.$$('[data-test="offer-card"], .offer-card, a[href*="/praca/"]');

    for (const card of jobCards) {
      try {
        const titleEl = await card.$('h2, h3, [data-test="offer-title"], .offer-title');
        const title = titleEl ? (await titleEl.textContent())?.trim() : null;
        if (!title) continue;

        const companyEl = await card.$('[data-test="offer-company"], .offer-company, span[class*="company"]');
        const company = companyEl ? (await companyEl.textContent())?.trim() ?? 'Unknown' : 'Unknown';

        const linkEl = await card.$('a[href]');
        const href = linkEl ? await linkEl.getAttribute('href') : null;
        const sourceUrl = href?.startsWith('http') ? href : href ? `https://it.pracuj.pl${href}` : null;
        if (!sourceUrl) continue;

        const locationEl = await card.$('[data-test="offer-location"], .offer-location, span[class*="location"]');
        const locationText = locationEl ? (await locationEl.textContent())?.trim() : '';
        const city = locationText?.split(',')[0]?.trim() || undefined;

        const salaryEl = await card.$('[data-test="offer-salary"], .offer-salary, span[class*="salary"]');
        const salaryText = salaryEl ? (await salaryEl.textContent())?.trim() : '';
        let salaryMin: number | undefined;
        let salaryMax: number | undefined;
        if (salaryText) {
          const nums = salaryText.replace(/\s/g, '').match(/(\d[\d,.]*)/g);
          if (nums && nums.length >= 2) {
            salaryMin = Math.round(parseFloat(nums[0].replace(/,/g, '')));
            salaryMax = Math.round(parseFloat(nums[1].replace(/,/g, '')));
          } else if (nums && nums.length === 1) {
            salaryMin = Math.round(parseFloat(nums[0].replace(/,/g, '')));
          }
        }

        const techEls = await card.$$('[data-test="offer-tags"] span, .offer-tags span, span[class*="tag"]');
        const technologies: string[] = [];
        for (const t of techEls) {
          const text = (await t.textContent())?.trim();
          if (text && text.length < 50) technologies.push(text);
        }

        const combinedText = `${title} ${salaryText} ${locationText}`.toLowerCase();
        const isRemote = combinedText.includes('remote') || combinedText.includes('zdaln');
        const isHybrid = combinedText.includes('hybrid') || combinedText.includes('hybryd');

        const slug = sourceUrl.split('/').pop() ?? `${company}-${title}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');

        jobs.push({
          source: 'pracuj',
          externalId: slug,
          sourceUrl,
          title,
          company,
          city,
          region: undefined,
          remote: isRemote,
          workMode: isRemote ? 'remote' : isHybrid ? 'hybrid' : 'office',
          salaryMin,
          salaryMax,
          salaryCurrency: 'PLN',
          technologies,
          description: undefined,
          publishedAt: undefined,
        });
      } catch {
        // skip malformed card
      }
    }
  } catch (e) {
    console.warn(`pracuj: failed to scrape ${url} -`, e instanceof Error ? e.message : e);
  } finally {
    await context.close();
  }

  return jobs;
}

export const pracujScraper: Scraper = {
  name: 'pracuj',

  async fetchJobs(): Promise<JobOfferInput[]> {
    const allJobs: JobOfferInput[] = [];
    const seenIds = new Set<string>();

    for (const url of SEARCH_URLS) {
      try {
        const jobs = await scrapePage(url);
        for (const job of jobs) {
          if (!seenIds.has(job.externalId)) {
            seenIds.add(job.externalId);
            allJobs.push(job);
          }
        }
        await new Promise((r) => setTimeout(r, 2000));
      } catch (e) {
        console.warn(`pracuj: query "${url}" failed -`, e instanceof Error ? e.message : e);
      }
    }

    if (browser) {
      await browser.close().catch(() => {});
      browser = null;
    }

    return allJobs;
  },
};
