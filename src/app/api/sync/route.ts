import { NextResponse } from 'next/server';
import { runAllScrapers } from '@/scrapers';

export const maxDuration = 120;

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  const apiKey = process.env.SYNC_API_KEY;

  if (apiKey && authHeader !== `Bearer ${apiKey}`) {
    return NextResponse.json({ error: 'Nieautoryzowany dostęp' }, { status: 401 });
  }

  try {
    const result = await runAllScrapers();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
