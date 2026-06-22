import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@/generated/prisma/client';

const ALLOWED_SORT_COLUMNS = [
  'createdAt', 'updatedAt', 'title', 'company', 'city',
  'salaryMin', 'salaryMax', 'publishedAt', 'source',
] as const;

const ALLOWED_ORDERS = ['asc', 'desc'] as const;

function clampInt(value: string | null, min: number, max: number, fallback: number): number {
  const parsed = parseInt(value ?? '');
  if (isNaN(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().trim().replace(/\s+/g, ' ');
}

interface JobSource {
  id: string;
  source: string;
  sourceUrl: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  publishedAt: Date | null;
  fetchedAt: Date;
}

interface GroupedJob {
  id: string;
  title: string;
  company: string;
  city: string | null;
  region: string | null;
  workMode: string | null;
  remote: boolean;
  technologies: string[];
  description: string | null;
  publishedAt: Date | null;
  sourceCount: number;
  sources: JobSource[];
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const page = clampInt(searchParams.get('page'), 1, 10000, 1);
  const limit = clampInt(searchParams.get('limit'), 1, 100, 25);
  const search = searchParams.get('search') ?? '';
  const city = searchParams.get('city') ?? '';
  const technology = searchParams.get('technology') ?? '';
  const workModeParam = searchParams.get('workMode') ?? '';
  const salaryMin = searchParams.get('salaryMin')
    ? parseInt(searchParams.get('salaryMin')!)
    : undefined;
  const salaryMax = searchParams.get('salaryMax')
    ? parseInt(searchParams.get('salaryMax')!)
    : undefined;
  const company = searchParams.get('company') ?? '';
  const publishedAfter = searchParams.get('publishedAfter') ?? '';
  const sourceParam = searchParams.get('source') ?? '';
  const idsParam = searchParams.get('ids') ?? '';
  const sortParam = searchParams.get('sort') ?? 'createdAt';
  const orderParam = searchParams.get('order') ?? 'desc';
  const grouped = searchParams.get('grouped') !== 'false';

  const sort = ALLOWED_SORT_COLUMNS.includes(sortParam as any)
    ? sortParam
    : 'createdAt';
  const order = ALLOWED_ORDERS.includes(orderParam as any)
    ? orderParam
    : 'desc';

  const where: Prisma.JobOfferWhereInput = {};

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { company: { contains: search, mode: 'insensitive' } },
      { technologies: { has: search } },
    ];
  }

  if (city) where.city = { contains: city, mode: 'insensitive' };
  if (technology) {
    const techs = technology.split(',').map((t) => t.trim());
    where.technologies = { hasSome: techs };
  }
  if (workModeParam) {
    const workModes = workModeParam.split(',').map((m) => m.trim()).filter(Boolean);
    if (workModes.length > 0) where.workMode = { in: workModes };
  }
  if (salaryMin) where.salaryMin = { gte: salaryMin };
  if (salaryMax) where.salaryMax = { lte: salaryMax };
  if (company) where.company = { contains: company, mode: 'insensitive' };
  if (publishedAfter)
    where.publishedAt = { gte: new Date(publishedAfter) };
  if (sourceParam) {
    const sources = sourceParam.split(',').map((s) => s.trim()).filter(Boolean);
    if (sources.length > 0) where.source = { in: sources };
  }
  if (idsParam) {
    const ids = idsParam.split(',').map((id) => id.trim()).filter(Boolean);
    if (ids.length > 0) where.id = { in: ids };
  }

  const hasIdsFilter = !!idsParam;

  if (!grouped) {
    const countPromise = db.jobOffer.count({ where });
    const allTotalPromise = hasIdsFilter
      ? db.jobOffer.count({ where: { ...where, id: undefined } })
      : countPromise;
    const [jobs, total, allTotal] = await Promise.all([
      db.jobOffer.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sort]: order },
      }),
      countPromise,
      allTotalPromise,
    ]);

    return NextResponse.json({
      jobs,
      pagination: { page, limit, total, allTotal, totalPages: Math.ceil(total / limit) },
    });
  }

  const allJobs = await db.jobOffer.findMany({
    where,
    orderBy: { [sort]: order },
  });

  const groupMap = new Map<string, GroupedJob>();

  for (const job of allJobs) {
    const key = `${normalizeTitle(job.title)}|||${job.company.toLowerCase().trim()}`;
    const existing = groupMap.get(key);

    const source: JobSource = {
      id: job.id,
      source: job.source,
      sourceUrl: job.sourceUrl,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      salaryCurrency: job.salaryCurrency,
      publishedAt: job.publishedAt,
      fetchedAt: job.fetchedAt,
    };

    if (existing) {
      existing.sources.push(source);
      existing.sourceCount++;
      if (job.publishedAt && (!existing.publishedAt || job.publishedAt > existing.publishedAt)) {
        existing.publishedAt = job.publishedAt;
      }
    } else {
      groupMap.set(key, {
        id: job.id,
        title: job.title,
        company: job.company,
        city: job.city,
        region: job.region,
        workMode: job.workMode,
        remote: job.remote,
        technologies: job.technologies,
        description: job.description,
        publishedAt: job.publishedAt,
        sourceCount: 1,
        sources: [source],
      });
    }
  }

  const groups = Array.from(groupMap.values());

  groups.sort((a, b) => {
    if (sort === 'publishedAt') {
      const aTime = a.publishedAt?.getTime() ?? 0;
      const bTime = b.publishedAt?.getTime() ?? 0;
      return order === 'desc' ? bTime - aTime : aTime - bTime;
    }
    if (sort === 'title') {
      return order === 'desc'
        ? b.title.localeCompare(a.title)
        : a.title.localeCompare(b.title);
    }
    if (sort === 'company') {
      return order === 'desc'
        ? b.company.localeCompare(a.company)
        : a.company.localeCompare(b.company);
    }
    if (sort === 'city') {
      const aCity = a.city ?? '';
      const bCity = b.city ?? '';
      return order === 'desc' ? bCity.localeCompare(aCity) : aCity.localeCompare(bCity);
    }
    if (sort === 'salaryMin') {
      const aSal = a.sources.reduce((min, s) => Math.min(min, s.salaryMin ?? Infinity), Infinity);
      const bSal = b.sources.reduce((min, s) => Math.min(min, s.salaryMin ?? Infinity), Infinity);
      return order === 'desc' ? bSal - aSal : aSal - bSal;
    }
    if (sort === 'salaryMax') {
      const aSal = a.sources.reduce((max, s) => Math.max(max, s.salaryMax ?? -Infinity), -Infinity);
      const bSal = b.sources.reduce((max, s) => Math.max(max, s.salaryMax ?? -Infinity), -Infinity);
      return order === 'desc' ? bSal - aSal : aSal - bSal;
    }
    return 0;
  });

  const total = groups.length;
  const totalPages = Math.ceil(total / limit);
  const paged = groups.slice((page - 1) * limit, page * limit);

  const allTotal = hasIdsFilter
    ? (await db.jobOffer.findMany({ where: { ...where, id: undefined } }))
        .reduce((map, job) => {
          const key = `${normalizeTitle(job.title)}|||${job.company.toLowerCase().trim()}`;
          if (!map.has(key)) map.set(key, true);
          return map;
        }, new Map<string, boolean>()).size
    : groups.length;

  return NextResponse.json({
    jobs: paged,
    pagination: { page, limit, total, allTotal, totalPages },
  });
}
