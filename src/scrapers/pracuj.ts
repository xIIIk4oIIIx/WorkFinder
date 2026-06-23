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
    await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(3000);

    const offerLinks = await page.$$('[data-test="link-offer"]');

    for (const link of offerLinks) {
      try {
        const titleAttr = await link.getAttribute('title');
        const title = titleAttr?.replace(/^Zobacz ofertę\s+/, '').trim();
        if (!title) continue;

        const sourceUrl = await link.getAttribute('href');
        if (!sourceUrl) continue;

        const tile = await link.evaluateHandle((el) => el.closest('[class*="offer-tile"]') || el.parentElement?.parentElement?.parentElement);
        const tileEl = tile.asElement();

        let company = 'Unknown';
        if (tileEl) {
          const companyLink = await tileEl.$('[data-test="link-company-profile"]');
          if (companyLink) {
            const companyTitle = await companyLink.getAttribute('title');
            company = companyTitle?.replace(/^Zobacz profil pracodawcy\s+/, '').trim() || 'Unknown';
          }
        }

        let city: string | undefined;
        let locationText = '';
        if (tileEl) {
          const allText = await tileEl.textContent();
          const locationMatch = allText?.match(/([A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]+(?:\s*,\s*[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż-]+)*)/);
          if (locationMatch) {
            locationText = locationMatch[1];
            city = locationText.split(',')[0].trim();
          }
        }

        let salaryMin: number | undefined;
        let salaryMax: number | undefined;
        if (tileEl) {
          const allText = await tileEl.textContent();
          const salaryMatch = allText?.match(/(\d[\d\s,.]*)\s*(?:-|–)\s*(\d[\d\s,.]*)\s*(?:zł|PLN)/i)
            || allText?.match(/od\s+(\d[\d\s,.]*)\s*(?:zł|PLN)/i)
            || allText?.match(/do\s+(\d[\d\s,.]*)\s*(?:zł|PLN)/i);
          if (salaryMatch) {
            const parse = (s: string) => parseFloat(s.replace(/\s/g, '').replace(',', '.'));
            if (salaryMatch[2]) {
              salaryMin = Math.round(parse(salaryMatch[1]));
              salaryMax = Math.round(parse(salaryMatch[2]));
            } else if (salaryMatch[1]) {
              salaryMin = Math.round(parse(salaryMatch[1]));
            }
          }
        }

        const technologies: string[] = [];
        if (tileEl) {
          const tagEls = await tileEl.$$('span[class*="tag"], span[data-test*="tag"]');
          for (const t of tagEls) {
            const text = (await t.textContent())?.trim();
            if (text && text.length < 40 && !text.includes('zł') && !text.includes('PLN')) {
              technologies.push(text);
            }
          }
        }

        let descriptionText = '';
        if (tileEl) {
          const allText = await tileEl.textContent();
          descriptionText = allText || '';
        }

        const combinedText = `${title} ${descriptionText}`.toLowerCase();
        const isRemote = combinedText.includes('remote') || combinedText.includes('zdaln');
        const isHybrid = combinedText.includes('hybrid') || combinedText.includes('hybryd');

        const offerId = sourceUrl.match(/oferta,(\d+)/)?.[1] || sourceUrl.split('/').pop() || '';

        jobs.push({
          source: 'pracuj',
          externalId: offerId,
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
