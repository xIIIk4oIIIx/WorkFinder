import useSWR from 'swr';
import { useState } from 'react';

export interface Stats {
  total: number;
  bySource: { source: string; count: number }[];
  lastSync: string | null;
  todayNew: number;
}

const CACHE_KEY = 'workfinder-stats-cache';

export function loadStatsCache(): Stats | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const stored = localStorage.getItem(CACHE_KEY);
    return stored ? JSON.parse(stored) : undefined;
  } catch {
    return undefined;
  }
}

function saveCache(data: Stats) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {}
}

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error(`Błąd serwera: ${r.status}`);
  return r.json();
});

export function useStats(initialCache?: Stats) {
  const { data, error, isLoading, mutate } = useSWR<Stats>('/api/stats', fetcher, {
    fallbackData: initialCache,
    revalidateOnMount: true,
    refreshInterval: 60000,
    dedupingInterval: 5000,
    revalidateOnFocus: true,
    onSuccess: (d) => saveCache(d),
  });

  // Prefer data with non-null lastSync to avoid showing "-" when we have cached timestamp
  const goodServerData = data?.lastSync !== null ? data : null;
  const goodCacheData = (initialCache ?? null)?.lastSync !== null ? (initialCache ?? null) : null;
  
  const finalData = 
    goodServerData ?? 
    goodCacheData ?? 
    (data ?? initialCache ?? null);

  return {
    stats: finalData,
    isLoading,
    error: error?.message ?? null,
    mutate,
  };
}