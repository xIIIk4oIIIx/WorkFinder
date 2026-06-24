import { Scraper, JobOfferInput } from './types';

const SEARCH_URLS = [
  'https://www.praca.pl/praca/informatyka-it',
  'https://www.praca.pl/praca/informatyka-it?kw=react',
  'https://www.praca.pl/praca/informatyka-it?kw=node',
  'https://www.praca.pl/praca/informatyka-it?kw=python',
  'https://www.praca.pl/praca/informatyka-it?kw=java',
  'https://www.praca.pl/praca/informatyka-it?kw=devops',
  'https://www.praca.pl/praca/informatyka-it?kw=frontend',
  'https://www.praca.pl/praca/informatyka-it?kw=backend',
];

export const pracaPlScraper: Scraper = {
  name: 'praca.pl',

  async fetchJobs(): Promise<JobOfferInput[]> {
    const allJobs: JobOfferInput[] = [];
    const seenIds = new Set<string>();

    for (const url of SEARCH_URLS) {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml',
          },
          signal: AbortSignal.timeout(30000),
        });
        if (!response.ok) continue;

        const html = await response.text();
        const jobs = parsePracaPlHtml(html);
        for (const job of jobs) {
          if (!seenIds.has(job.externalId)) {
            seenIds.add(job.externalId);
            allJobs.push(job);
          }
        }
        await new Promise((r) => setTimeout(r, 2000));
      } catch (e) {
        console.warn(`praca.pl: query "${url}" failed -`, e instanceof Error ? e.message : e);
      }
    }

    return allJobs;
  },
};

function parsePracaPlHtml(html: string): JobOfferInput[] {
  const jobs: JobOfferInput[] = [];

  const cardRegex = /<div[^>]*class="[^"]*offer[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>/gi;
  let match;

  while ((match = cardRegex.exec(html)) !== null) {
    try {
      const cardHtml = match[0];

      const linkMatch = cardHtml.match(/<a[^>]*href="(https?:\/\/www\.praca\.pl\/oferta\/[^"]+)"[^>]*>/i)
        || cardHtml.match(/<a[^>]*href="(\/oferta\/[^"]+)"[^>]*>/i);
      const href = linkMatch?.[1];
      if (!href) continue;

      const sourceUrl = href.startsWith('http') ? href : `https://www.praca.pl${href}`;

      const titleMatch = cardHtml.match(/<h[23][^>]*>([^<]+)<\/h[23]>/i)
        || cardHtml.match(/<a[^>]*href="[^"]*oferta[^"]*"[^>]*>([^<]+)<\/a>/i);
      const title = titleMatch?.[1]?.trim();
      if (!title) continue;

      const companyMatch = cardHtml.match(/<span[^>]*class="[^"]*company[^"]*"[^>]*>([^<]+)<\/span>/i)
        || cardHtml.match(/<p[^>]*class="[^"]*employer[^"]*"[^>]*>([^<]+)<\/p>/i);
      const company = companyMatch?.[1]?.trim() ?? 'Unknown';

      const cityMatch = cardHtml.match(/<span[^>]*class="[^"]*location[^"]*"[^>]*>([^<]+)<\/span>/i)
        || cardHtml.match(/<span[^>]*class="[^"]*city[^"]*"[^>]*>([^<]+)<\/span>/i);
      const city = cityMatch?.[1]?.trim();

      const salaryMatch = cardHtml.match(/(\d[\d\s,.]*)\s*(?:-|–)\s*(\d[\d\s,.]*)\s*(?:zł|PLN)/i)
        || cardHtml.match(/od\s+(\d[\d\s,.]*)\s*(?:zł|PLN)/i);
      let salaryMin: number | undefined;
      let salaryMax: number | undefined;
      if (salaryMatch) {
        const parse = (s: string) => Math.round(parseFloat(s.replace(/\s/g, '').replace(',', '.')));
        if (salaryMatch[2]) {
          salaryMin = parse(salaryMatch[1]);
          salaryMax = parse(salaryMatch[2]);
        } else if (salaryMatch[1]) {
          salaryMin = parse(salaryMatch[1]);
        }
      }

      const offerIdMatch = sourceUrl.match(/oferta\/(\d+)/);
      const externalId = offerIdMatch?.[1] || sourceUrl.split('/').pop() || '';

      const combinedText = `${title} ${company}`.toLowerCase();
      const isRemote = combinedText.includes('remote') || combinedText.includes('zdaln');
      const isHybrid = combinedText.includes('hybrid') || combinedText.includes('hybryd');

      jobs.push({
        source: 'praca.pl',
        externalId,
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
        technologies: [],
        description: undefined,
        publishedAt: undefined,
      });
    } catch {
      // skip malformed card
    }
  }

  return jobs;
}
