import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [total, bySource, latestFetched, todayNew] = await Promise.all([
    db.jobOffer.count(),
    db.jobOffer.groupBy({ by: ['source'], _count: true }),
    db.jobOffer.findFirst({
      orderBy: { fetchedAt: 'desc' },
      select: { fetchedAt: true },
    }),
    db.jobOffer.count({
      where: { createdAt: { gte: todayStart } },
    }),
  ]);

  return NextResponse.json({
    total,
    bySource: bySource.map((s: { source: string; _count: number }) => ({ source: s.source, count: s._count })),
    lastSync: latestFetched?.fetchedAt ?? null,
    todayNew,
  });
}
