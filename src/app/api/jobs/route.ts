import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@/generated/prisma/client';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = parseInt(searchParams.get('limit') ?? '25');
  const search = searchParams.get('search') ?? '';
  const city = searchParams.get('city') ?? '';
  const technology = searchParams.get('technology') ?? '';
  const workMode = searchParams.get('workMode') ?? '';
  const salaryMin = searchParams.get('salaryMin')
    ? parseInt(searchParams.get('salaryMin')!)
    : undefined;
  const salaryMax = searchParams.get('salaryMax')
    ? parseInt(searchParams.get('salaryMax')!)
    : undefined;
  const company = searchParams.get('company') ?? '';
  const publishedAfter = searchParams.get('publishedAfter') ?? '';
  const sort = searchParams.get('sort') ?? 'createdAt';
  const order = searchParams.get('order') ?? 'desc';

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
  if (workMode) where.workMode = workMode;
  if (salaryMin) where.salaryMin = { gte: salaryMin };
  if (salaryMax) where.salaryMax = { lte: salaryMax };
  if (company) where.company = { contains: company, mode: 'insensitive' };
  if (publishedAfter)
    where.publishedAt = { gte: new Date(publishedAfter) };

  const [jobs, total] = await Promise.all([
    db.jobOffer.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { [sort]: order },
    }),
    db.jobOffer.count({ where }),
  ]);

  return NextResponse.json({
    jobs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
