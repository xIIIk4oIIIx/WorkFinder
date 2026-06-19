import { Scraper, JobOfferInput } from './types';

export const olxScraper: Scraper = {
  name: 'olx',

  async fetchJobs(): Promise<JobOfferInput[]> {
    const allJobs: JobOfferInput[] = [];
    const seenIds = new Set<string>();

    for (let offset = 0; offset < 1000; offset += 40) {
      const url = `https://www.olx.pl/api/v1/offers/?category_id=4&offset=${offset}&limit=40`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) break;
      const data = await response.json();
      if (!data.data || data.data.length === 0) break;

      for (const item of data.data) {
        const id = String(item.id);
        if (seenIds.has(id)) continue;
        seenIds.add(id);

        const salaryParam = item.params?.find((p: any) => p.key === 'salary');
        const workParam = item.params?.find((p: any) => p.key === 'workplace');
        const workplaceKeys: string[] = Array.isArray(workParam?.value?.key)
          ? workParam.value.key
          : workParam?.value?.key
            ? [workParam.value.key]
            : [];

        const isRemote = workplaceKeys.includes('remote_work_possibility');
        const isHybrid = workplaceKeys.includes('hybrid');

        const desc = (item.description ?? '').replace(/<[^>]*>/g, '');
        const combined = `${item.title} ${desc}`.toLowerCase();
        const mentionsRemote = combined.includes('zdaln') || combined.includes('remote') || combined.includes('home office');

        allJobs.push({
          source: 'olx',
          externalId: id,
          sourceUrl: item.url ?? `https://www.olx.pl/oferta/${id}`,
          title: item.title,
          company: item.user?.name ?? 'Unknown',
          city: item.location?.city?.name ?? undefined,
          region: item.location?.region?.name ?? undefined,
          remote: isRemote || mentionsRemote,
          workMode: isRemote ? 'remote' : isHybrid ? 'hybrid' : mentionsRemote ? 'remote' : 'office',
          salaryMin: salaryParam?.value?.from ? Math.round(salaryParam.value.from) : undefined,
          salaryMax: salaryParam?.value?.to ? Math.round(salaryParam.value.to) : undefined,
          salaryCurrency: salaryParam?.value?.currency ?? 'PLN',
          technologies: [],
          description: desc.substring(0, 500),
          publishedAt: item.created_time ? new Date(item.created_time) : undefined,
        });
      }
    }

    return allJobs;
  },
};
