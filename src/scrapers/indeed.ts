import { Scraper, JobOfferInput } from './types';
import { chromium, Browser } from 'playwright';

const SEARCH_URLS = [
  'https://pl.indeed.com/praca?q=it&l=Polska',
  'https://pl.indeed.com/praca?q=react&l=Polska',
  'https://pl.indeed.com/praca?q=node&l=Polska',
  'https://pl.indeed.com/praca?q=python&l=Polska',
  'https://pl.indeed.com/praca?q=java&l=Polska',
  'https://pl.indeed.com/praca?q=devops&l=Polska',
  'https://pl.indeed.com/praca?q=frontend&l=Polska',
  'https://pl.indeed.com/praca?q=backend&l=Polska',
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

export const indeedScraper: Scraper = {
  name: 'indeed',

  async fetchJobs(): Promise<JobOfferInput[]> {
    const allJobs: JobOfferInput[] = [];
    const seenIds = new Set<string>();

    for (const url of SEARCH_URLS) {
      try {
        const b = await getBrowser();
        const context = await b.newContext({
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          locale: 'pl-PL',
        });
        const page = await context.newPage();

        await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
        await page.waitForTimeout(3000);

        const jobCards = await page.$$('[data-testid="job-card"], .jobsearch-ResultsList .result');

        for (const card of jobCards) {
          try {
            const titleEl = await card.$('h2 a, .jobTitle a, [data-testid="jobTitle"]');
            const title = titleEl ? (await titleEl.textContent())?.trim() : null;
            if (!title) continue;

            const href = titleEl ? await titleEl.getAttribute('href') : null;
            const sourceUrl = href?.startsWith('http') ? href : href ? `https://pl.indeed.com${href}` : null;
            if (!sourceUrl) continue;

            const companyEl = await card.$('.companyName, [data-testid="company-name"]');
            const company = companyEl ? (await companyEl.textContent())?.trim() ?? 'Unknown' : 'Unknown';

            const locationEl = await card.$('.companyLocation, [data-testid="text-location"]');
            const locationText = locationEl ? (await locationEl.textContent())?.trim() : '';
            const city = locationText?.split(',')[0]?.trim() || undefined;

            const salaryEl = await card.$('.salary-snippet, [data-testid="attribute_snippet_testid"]');
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

            const combinedText = `${title} ${salaryText} ${locationText}`.toLowerCase();
            const isRemote = combinedText.includes('remote') || combinedText.includes('zdaln');
            const isHybrid = combinedText.includes('hybrid') || combinedText.includes('hybryd');

            const offerIdMatch = sourceUrl.match(/jk=([a-f0-9]+)/);
            const externalId = offerIdMatch?.[1] || sourceUrl.split('/').pop() || '';

            allJobs.push({
              source: 'indeed',
              externalId,
              sourceUrl: sourceUrl.split('?')[0],
              title,
              company,
              city,
              region: undefined,
              remote: isRemote,
              workMode: isRemote ? 'remote' : isHybrid ? 'hybrid' : 'office',
              salaryMin,
              salaryMax,
              salaryCurrency: 'PLN',
              technologies: [],
              description: undefined,
              publishedAt: undefined,
            });
          } catch {
            // skip malformed card
          }
        }

        await context.close();
        await new Promise((r) => setTimeout(r, 3000));
      } catch (e) {
        console.warn(`indeed: query "${url}" failed -`, e instanceof Error ? e.message : e);
      }
    }

    if (browser) {
      await browser.close().catch(() => {});
      browser = null;
    }

    return allJobs.filter((job) => {
      if (!seenIds.has(job.externalId)) {
        seenIds.add(job.externalId);
        return true;
      }
      return false;
    });
  },
};
