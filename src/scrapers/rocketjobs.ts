import { Scraper, JobOfferInput } from './types';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml',
  'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7',
};

export const rocketjobsScraper: Scraper = {
  name: 'rocketjobs',

  async fetchJobs(): Promise<JobOfferInput[]> {
    const allJobs: JobOfferInput[] = [];
    const seenIds = new Set<string>();

    try {
      const response = await fetch('https://rocketjobs.pl/', {
        headers: HEADERS,
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) throw new Error(`rocketjobs: HTTP ${response.status}`);
      const html = await response.text();

      const urlPattern = /href="https:\/\/rocketjobs\.pl\/oferta-pracy\/([^"]+)"/g;
      let urlMatch;
      while ((urlMatch = urlPattern.exec(html)) !== null) {
        const slug = urlMatch[1];
        if (seenIds.has(slug)) continue;
        seenIds.add(slug);

        const after = html.substring(urlMatch.index, urlMatch.index + 4000);

        const textPattern = />([^<]{1,100})</g;
        let tm;
        const texts: string[] = [];
        while ((tm = textPattern.exec(after)) !== null) {
          const t = tm[1].trim();
          if (t && t.length > 0) texts.push(t);
        }

        const SKIP = new Set([
          'Nowa', 'Super oferta', 'Lokalizacje', 'PLN/mies.', 'PLN',
          'Praca stacjonarna', 'Praca w pełni zdalna', 'Praca hybrydowa',
          'Stacjonarnie', 'Zdalnie', 'Hybrydowo',
          'B2B', 'UoP', 'UZ', 'B2B, Umowa o pracę', 'B2B, UZ',
          'Umowa o pracę', 'Umowa zlecenie',
          'Junior', 'Mid', 'Senior', 'Praktykant', 'Kierownik / Manager',
          'Specjalista / Mid', 'Manager', 'Lead / Principal',
        ]);

        const isSalary = (t: string) => /^\d[\d\s]*-\s*\d/.test(t);
        const isLocationCount = (t: string) => /^\+\d+$/.test(t);
        const isSkill = (t: string) => t.length > 2 && t.length < 30 && !SKIP.has(t) && !isSalary(t) && !isLocationCount(t);

        let company = 'Unknown';
        let city: string | undefined;
        let title = '';
        let salaryMin: number | undefined;
        let salaryMax: number | undefined;
        const technologies: string[] = [];
        let remote = false;

        for (let i = 0; i < texts.length && i < 20; i++) {
          const t = texts[i];

          if (i === 0 && !SKIP.has(t) && !isSalary(t) && !isLocationCount(t)) {
            company = t.replace(/&quot;/g, '"').trim();
            continue;
          }

          if (i === 1 && !SKIP.has(t) && !isSalary(t) && !isLocationCount(t) && t !== company) {
            city = t.trim();
            continue;
          }

          if (isLocationCount(t)) continue;

          if (['Praca stacjonarna', 'Praca w pełni zdalna', 'Praca hybrydowa'].includes(t)) {
            remote = t.includes('zdaln');
            continue;
          }

          if (['Stacjonarnie', 'Zdalnie', 'Hybrydowo'].includes(t)) continue;

          if (!title && !SKIP.has(t) && !isSalary(t) && t !== company && t !== city && t.length > 5) {
            title = t.trim();
            continue;
          }

          if (title && isSalary(t)) {
            const nums = t.replace(/\s/g, '').match(/(\d+)-(\d+)/);
            if (nums) {
              salaryMin = parseInt(nums[1]);
              salaryMax = parseInt(nums[2]);
            }
            continue;
          }

          if (title && isSkill(t) && technologies.length < 8) {
            technologies.push(t);
          }
        }

        if (!title) {
          const slugParts = slug.split('---');
          title = slugParts[slugParts.length - 1]
            .replace(/-[a-z]+-\d+$/, '')
            .replace(/-/g, ' ')
            .replace(/\b\w/g, (c: string) => c.toUpperCase());
        }

        allJobs.push({
          source: 'rocketjobs',
          externalId: slug,
          sourceUrl: `https://rocketjobs.pl/oferta-pracy/${slug}`,
          title,
          company,
          city,
          region: undefined,
          remote,
          workMode: remote ? 'remote' : 'office',
          salaryMin,
          salaryMax,
          salaryCurrency: 'PLN',
          technologies,
          description: undefined,
          publishedAt: undefined,
        });
      }
    } catch {
      // RocketJobs scraping may fail
    }

    return allJobs;
  },
};
