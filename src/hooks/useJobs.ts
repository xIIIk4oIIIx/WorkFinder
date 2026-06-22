import useSWR from 'swr';
import { useRef, useCallback } from 'react';
import type { Job, GroupedJob } from '@/types/job';
import type { FilterState } from '@/components/Filters';

interface JobsResponse {
  jobs: (Job | GroupedJob)[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    allTotal?: number;
    totalPages: number;
  };
}

const CACHE_PREFIX = 'workfinder-jobs-cache:';

function getCacheKey(url: string): string {
  return CACHE_PREFIX + url;
}

function loadCache(url: string): JobsResponse | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const stored = localStorage.getItem(getCacheKey(url));
    return stored ? JSON.parse(stored) : undefined;
  } catch {
    return undefined;
  }
}

function saveCache(url: string, data: JobsResponse) {
  try {
    localStorage.setItem(getCacheKey(url), JSON.stringify(data));
  } catch {}
}

function buildJobsUrl(
  page: number,
  search: string,
  filters: FilterState,
  showFavoritesOnly: boolean,
  favorites: Set<string>
): string {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', '25');
  params.set('grouped', 'true');
  if (search) params.set('search', search);
  if (filters.city) params.set('city', filters.city);
  if (filters.technology) params.set('technology', filters.technology);
  if (filters.workMode.length > 0) params.set('workMode', filters.workMode.join(','));
  if (filters.salaryMin) params.set('salaryMin', filters.salaryMin);
  if (filters.salaryMax) params.set('salaryMax', filters.salaryMax);
  if (filters.company) params.set('company', filters.company);
  if (filters.publishedAfter) params.set('publishedAfter', filters.publishedAfter);
  if (filters.sources.length > 0) params.set('source', filters.sources.join(','));
  if (showFavoritesOnly && favorites.size > 0) {
    params.set('ids', [...favorites].join(','));
  }
  return `/api/jobs?${params.toString()}`;
}

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error(`Błąd serwera: ${r.status}`);
  return r.json();
});

export function useJobs(
  page: number,
  search: string,
  filters: FilterState,
  showFavoritesOnly: boolean,
  favorites: Set<string>
) {
  const key = buildJobsUrl(page, search, filters, showFavoritesOnly, favorites);
  const cacheRef = useRef<JobsResponse | undefined>(undefined);
  if (cacheRef.current === undefined) {
    cacheRef.current = loadCache(key);
  }

  const { data, error, isLoading, isValidating, mutate } = useSWR<JobsResponse>(key, fetcher, {
    fallbackData: cacheRef.current,
    dedupingInterval: 2000,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    onSuccess: (d) => saveCache(key, d),
  });

  const isInitialLoad = isLoading && !data;

  return {
    jobs: data?.jobs ?? cacheRef.current?.jobs ?? [],
    total: data?.pagination.allTotal ?? data?.pagination.total ?? cacheRef.current?.pagination.allTotal ?? cacheRef.current?.pagination.total ?? 0,
    totalPages: data?.pagination.totalPages ?? cacheRef.current?.pagination.totalPages ?? 1,
    isLoading: isInitialLoad,
    isValidating,
    error: error?.message ?? null,
    mutate,
  };
}
