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

function parseSalaryNumber(s: string): number {
  return Math.round(parseFloat(s.replace(/\s/g, '').replace(',', '.')));
}

const POLISH_CITIES = [
  'Warszawa', 'Kraków', 'Wrocław', 'Poznań', 'Gdańsk', 'Łódź',
  'Katowice', 'Szczecin', 'Lublin', 'Bydgoszcz', 'Białystok',
  'Katowice', 'Gdynia', 'Częstochowa', 'Radom', 'Toruń',
  'Sosnowiec', 'Rzeszów', 'Kielce', 'Gliwice', 'Zabrze',
  'Olsztyn', 'Bielsko-Biała', 'Bytom', 'Zielona Góra', 'Rybnik',
  'Ruda Śląska', 'Opole', 'Tychy', 'Gorzów', 'Elbląg',
  'Płock', 'Dąbrowa Górnicza', 'Wałbrzych', 'Włocławek', 'Tarnów',
  'Chorzów', 'Koszalin', 'Kalisz', 'Legnica', 'Jaworzno',
  'Jelenia Góra', 'Nowy Sącz', 'Konin', 'Piotrków', 'Inowrocław',
  'Lubin', 'Ostrów', 'Stargard', 'Gniezno', 'Otwock',
  'Piła', 'Zamość', 'Leszno', 'Łomża', 'Chełm',
  'Ełk', 'Ostrołęka', 'Stalowa Wola', 'Tarnobrzeg', 'Przemyśl',
  'Tczew', 'Będzin', 'Pszczyna', 'Mysłowice', 'Zgorzelec',
  'Sanok', 'Nysa', 'Brzeg', 'Piekary', 'Cieszyn',
  'Starachowice', 'Zawiercie', 'Wodzisław', 'Częstochowa',
  'Siedlce', 'Mińsk Mazowiecki', 'Ostrowiec', 'Puławy', 'Suwałki',
];

function findCity(text: string): string | undefined {
  for (const city of POLISH_CITIES) {
    if (text.includes(city)) return city;
  }
  const match = text.match(/\b([A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]{2,})\b/);
  return match?.[1];
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

        const href = await link.getAttribute('href');
        if (!href) continue;
        const sourceUrl = href.split('?')[0];

        const offerId = sourceUrl.match(/oferta,(\d+)/)?.[1];
        if (!offerId) continue;

        const tileHandle = await link.evaluateHandle((el) => {
          let node = el as HTMLElement;
          for (let i = 0; i < 10; i++) {
            node = node.parentElement as HTMLElement;
            if (!node) return el.parentElement?.parentElement?.parentElement?.parentElement || el;
            const cn = node.className || '';
            if (cn.includes('offer-tile') || cn.includes('cobg3mp') || cn.includes('cjkyq1p')) return node;
          }
          return el.parentElement?.parentElement?.parentElement?.parentElement || el;
        });
        const tileEl = tileHandle.asElement();

        let company = 'Unknown';
        let city: string | undefined;
        let salaryMin: number | undefined;
        let salaryMax: number | undefined;
        const technologies: string[] = [];

        if (tileEl) {
          const companyLink = await tileEl.$('[data-test="link-company-profile"]');
          if (companyLink) {
            const ct = await companyLink.getAttribute('title');
            company = ct?.replace(/^Zobacz profil pracodawcy\s+/, '').trim() || 'Unknown';
          }

          const tileText = await tileEl.textContent() || '';

          const salaryMatch = tileText.match(/(\d[\d\s,.]*)\s*[–\-]\s*(\d[\d\s,.]*)\s*(?:zł|PLN)/i)
            || tileText.match(/od\s+(\d[\d\s,.]*)\s*(?:zł|PLN)/i);
          if (salaryMatch) {
            if (salaryMatch[2]) {
              salaryMin = parseSalaryNumber(salaryMatch[1]);
              salaryMax = parseSalaryNumber(salaryMatch[2]);
            } else if (salaryMatch[1]) {
              salaryMin = parseSalaryNumber(salaryMatch[1]);
            }
          }

          city = findCity(tileText);

          const tagEls = await tileEl.$$('span');
          for (const t of tagEls) {
            const text = (await t.textContent())?.trim();
            if (text && text.length >= 2 && text.length < 30
              && !text.includes('zł') && !text.includes('PLN')
              && !text.includes('Superoferta') && !text.includes('Publik')
              && !text.includes('etatumowa') && !text.includes('specjalist')
              && !text.includes('Menedżer') && !text.includes('Pracownik')
              && !text.includes('Sprawdź') && !text.includes('Profil')
              && text !== company && !text.includes('godz')
              && !text.match(/^\d/)) {
              technologies.push(text);
            }
          }
        }

        const combinedText = `${title}`.toLowerCase();
        const isRemote = combinedText.includes('remote') || combinedText.includes('zdaln');
        const isHybrid = combinedText.includes('hybrid') || combinedText.includes('hybryd');

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
          technologies: technologies.slice(0, 10),
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
