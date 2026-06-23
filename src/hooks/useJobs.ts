import useSWR from 'swr';
import { useState } from 'react';
import type { Job, GroupedJob } from '@/types/job';
import type { FilterState } from '@/components/Filters';

export interface JobsResponse {
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

export function loadJobsCache(url: string): JobsResponse | undefined {
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
  favorites: Set<string>,
  initialCache?: JobsResponse
) {
  const key = buildJobsUrl(page, search, filters, showFavoritesOnly, favorites);

  const { data, error, isLoading, isValidating, mutate } = useSWR<JobsResponse>(key, fetcher, {
    fallbackData: initialCache,
    revalidateOnMount: true,
    dedupingInterval: 2000,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    onSuccess: (d) => saveCache(key, d),
  });

  // Prefer data with non-empty jobs to avoid showing empty list when we have cached jobs
  const goodServerData = data?.jobs?.length ?? 0 > 0 ? data : null;
  const goodCacheData = (initialCache ?? null)?.jobs?.length ?? 0 > 0 ? (initialCache ?? null) : null;
  
  const finalData = 
    goodServerData ?? 
    goodCacheData ?? 
    (data ?? initialCache ?? null);

  const isInitialLoad = isLoading && !data;

  return {
    jobs: finalData?.jobs ?? [],
    total: finalData?.pagination.allTotal ?? finalData?.pagination.total ?? 0,
    totalPages: finalData?.pagination.totalPages ?? 1,
    isLoading: isInitialLoad,
    isValidating,
    error: error?.message ?? null,
    mutate,
  };
}