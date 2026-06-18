import { NextResponse } from 'next/server';
import { runAllScrapers } from '@/scrapers';

export async function POST() {
  const result = await runAllScrapers();
  return NextResponse.json(result);
}
