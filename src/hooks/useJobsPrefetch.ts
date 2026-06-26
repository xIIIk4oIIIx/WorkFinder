'use client';

import { useEffect, useRef } from 'react';
import { mutate } from 'swr';
import type { FilterState } from '@/components/Filters';
import type { JobsResponse } from './useJobs';

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error(`Błąd serwera: ${r.status}`);
  return r.json();
});

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
  if (filters.excludeSources.length > 0) params.set('excludeSource', filters.excludeSources.join(','));
  if (showFavoritesOnly && favorites.size > 0) {
    params.set('ids', [...favorites].join(','));
  }
  return `/api/jobs?${params.toString()}`;
}

async function prefetchPage(
  page: number,
  search: string,
  filters: FilterState,
  showFavoritesOnly: boolean,
  favorites: Set<string>
) {
  const url = buildJobsUrl(page, search, filters, showFavoritesOnly, favorites);
  try {
    const data = await fetcher(url);
    mutate(url, data, false);
  } catch {}
}

export function useJobsPrefetch(
  currentPage: number,
  search: string,
  filters: FilterState,
  showFavoritesOnly: boolean,
  favorites: Set<string>,
  totalPages: number
) {
  const lastPrefetched = useRef(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const pagesToPrefetch = [1, 2, 3];
    for (const p of pagesToPrefetch) {
      if (p <= totalPages) {
        prefetchPage(p, search, filters, showFavoritesOnly, favorites);
      }
    }
  }, [search, filters, showFavoritesOnly, favorites, totalPages]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (currentPage < 3) return;
    if (currentPage <= lastPrefetched.current) return;

    lastPrefetched.current = currentPage;

    for (let i = 1; i <= 3; i++) {
      const p = currentPage + i;
      if (p <= totalPages) {
        prefetchPage(p, search, filters, showFavoritesOnly, favorites);
      }
    }
  }, [currentPage, search, filters, showFavoritesOnly, favorites, totalPages]);
}
