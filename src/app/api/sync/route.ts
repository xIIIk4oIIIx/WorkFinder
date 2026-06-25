import { NextResponse } from 'next/server';
import { runAllScrapers } from '@/scrapers';

export const maxDuration = 120;

export async function POST() {
  try {
    const result = await runAllScrapers();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
