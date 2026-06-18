import { NextRequest, NextResponse } from 'next/server';
import { runAllScrapers } from '@/scrapers';

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key');
  const expectedKey = process.env.SYNC_API_KEY;

  if (!expectedKey || apiKey !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await runAllScrapers();
  return NextResponse.json(result);
}
