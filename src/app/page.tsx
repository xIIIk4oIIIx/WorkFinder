'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { SearchBar } from '@/components/SearchBar';
import { Filters, FilterState } from '@/components/Filters';
import { JobTable } from '@/components/JobTable';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import type { Job, GroupedJob } from '@/types/job';

// Favorites helpers (same as in JobTable)
function getFavorites(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const stored = localStorage.getItem('workfinder-favorites');
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

export default function Home() {
  const [jobs, setJobs] = useState<(Job | GroupedJob)[]>([]);
  const [allJobs, setAllJobs] = useState<(Job | GroupedJob)[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<FilterState>({
    city: '',
    technology: '',
    workMode: [],
    salaryMin: '',
    salaryMax: '',
    company: '',
    publishedAfter: '',
    sources: [],
  });
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{ total: number; bySource: { source: string; count: number }[]; lastSync: string | null; todayNew: number } | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // Load favorites on mount
  useEffect(() => {
    setFavorites(getFavorites());
  }, []);

  // Update favorites when storage changes
  useEffect(() => {
    const handleStorageChange = () => {
      setFavorites(getFavorites());
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
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

      const res = await fetch(`/api/jobs?${params.toString()}`);
      if (!res.ok) throw new Error(`Błąd serwera: ${res.status}`);
      const data = await res.json();
      setAllJobs(data.jobs);
      setTotal(data.pagination.allTotal ?? data.pagination.total);
      setTotalPages(data.pagination.totalPages);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się załadować danych');
    } finally {
      setLoading(false);
    }
  }, [page, search, filters, showFavoritesOnly]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {}
  }, []);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchJobs();
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchJobs]);

  useEffect(() => {
    if (showFavoritesOnly) {
      fetchJobs();
    }
  }, [favorites, showFavoritesOnly, fetchJobs]);

  const handleSearch = (query: string) => {
    setSearch(query);
    setPage(1);
  };

  const handleFilter = (newFilters: FilterState) => {
    setFilters(newFilters);
    setPage(1);
  };

  const handleSync = async () => {
    setSyncing(true);
    await fetch('/api/sync', { method: 'POST' });
    await fetchJobs();
    await fetchStats();
    setSyncing(false);
  };

  // Update displayed jobs when allJobs changes
  useEffect(() => {
    setJobs(allJobs);
  }, [allJobs]);

  const handleFavoritesChange = () => {
    setFavorites(getFavorites());
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="bg-card border-b border-border">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-6 py-3 lg:py-4">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-xl lg:text-2xl font-bold tracking-tight font-[family-name:var(--font-geist-sans)] whitespace-nowrap">WorkFinder</h1>

            {/* Compact mobile stats */}
            <div className="flex md:hidden items-center gap-3 text-xs">
              <div className="flex items-center gap-1">
                <span className="font-bold text-foreground">{total.toLocaleString('pl-PL')}</span>
                <span className="text-muted-foreground">ofert</span>
              </div>
              <div className="w-px h-3 bg-border" />
              <div className="flex items-center gap-1">
                <span className="font-bold text-accent">+{stats?.todayNew ?? 0}</span>
                <span className="text-muted-foreground">dziś</span>
              </div>
            </div>

            {/* Full desktop stats */}
            <div className="hidden md:grid grid-cols-4 gap-3">
              <div className="border border-border rounded-lg px-4 py-3 bg-background">
                <div className="text-2xl font-bold tracking-tight font-[family-name:var(--font-geist-sans)]">{total.toLocaleString('pl-PL')}</div>
                <div className="text-xs text-muted-foreground font-medium">Łącznie ofert</div>
              </div>
              <div className="border border-border rounded-lg px-4 py-3 bg-background">
                <div className="text-2xl font-bold tracking-tight font-[family-name:var(--font-geist-sans)] text-accent">+{stats?.todayNew ?? 0}</div>
                <div className="text-xs text-muted-foreground font-medium">Nowe dziś</div>
              </div>
              <div className="border border-border rounded-lg px-4 py-3 bg-background">
                <div className="text-2xl font-bold tracking-tight font-[family-name:var(--font-geist-sans)]">{stats?.bySource?.length ?? 0}</div>
                <div className="text-xs text-muted-foreground font-medium">Aktywne źródła</div>
              </div>
              <div className="border border-border rounded-lg px-4 py-3 bg-background">
                <div className="text-2xl font-bold tracking-tight font-[family-name:var(--font-geist-sans)]">{stats?.lastSync ? new Date(stats.lastSync).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }) : '—'}</div>
                <div className="text-xs text-muted-foreground font-medium">Ostatni sync</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button onClick={handleSync} disabled={syncing} variant="outline" size="sm">
              <svg className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                <polyline points="21 3 21 9 15 9" />
              </svg>
              <span className="hidden sm:inline">{syncing ? 'Odświeżanie...' : 'Odśwież'}</span>
              <span className="sm:hidden">{syncing ? '...' : ''}</span>
            </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto p-4 lg:p-6">
        <div className="flex gap-6">
          <aside className="w-60 flex-shrink-0 hidden lg:block sticky top-4 self-start">
            <Filters onFilter={handleFilter} />
          </aside>

          <section className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={() => setMobileFiltersOpen(true)}
                className="lg:hidden flex items-center gap-2 px-3 py-2 border border-border rounded-md bg-card text-foreground text-sm font-medium hover:bg-muted transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="4" x2="4" y1="21" y2="14" /><line x1="4" x2="4" y1="10" y2="3" />
                  <line x1="12" x2="12" y1="21" y2="12" /><line x1="12" x2="12" y1="8" y2="3" />
                  <line x1="20" x2="20" y1="21" y2="16" /><line x1="20" x2="20" y1="12" y2="3" />
                  <line x1="2" x2="6" y1="14" y2="14" /><line x1="10" x2="14" y1="8" y2="8" />
                  <line x1="18" x2="22" y1="16" y2="16" />
                </svg>
                Filtry
              </button>
              <button
                onClick={() => { setShowFavoritesOnly(!showFavoritesOnly); setPage(1); }}
                className={`flex items-center gap-2 px-3 py-2 border rounded-md text-sm font-medium transition-colors ${
                  showFavoritesOnly
                    ? 'border-rose-300 bg-rose-50 text-rose-600'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill={showFavoritesOnly ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                </svg>
                <span className="hidden sm:inline">Ulubione</span>
                {favorites.size > 0 && (
                  <span className="text-[10px] bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded-full font-medium">
                    {favorites.size}
                  </span>
                )}
              </button>
              <div className="flex-1">
                <SearchBar onSearch={handleSearch} />
              </div>
            </div>

            {error && (
              <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-sm">
                {error}
              </div>
            )}
            {loading ? (
              <div className="border border-border rounded-lg bg-card overflow-hidden">
                <div className="hidden lg:block">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted">
                        <th className="p-3 text-left text-[11px] font-[family-name:var(--font-mono)] font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap max-w-[260px]">Tytuł / Firma</th>
                        <th className="p-3 text-left text-[11px] font-[family-name:var(--font-mono)] font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">Lokalizacja</th>
                        <th className="p-3 text-left text-[11px] font-[family-name:var(--font-mono)] font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">Zarobki</th>
                        <th className="p-3 text-left text-[11px] font-[family-name:var(--font-mono)] font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">Technologie</th>
                        <th className="p-3 text-left text-[11px] font-[family-name:var(--font-mono)] font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap hidden xl:table-cell">Tryb</th>
                        <th className="p-3 text-left text-[11px] font-[family-name:var(--font-mono)] font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">Źródło</th>
                        <th className="p-3 text-left text-[11px] font-[family-name:var(--font-mono)] font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap hidden xl:table-cell">Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: 8 }).map((_, i) => (
                        <tr key={i} className="border-b border-border last:border-b-0">
                          <td className="p-3"><div className="h-4 bg-muted rounded animate-pulse w-3/4" /><div className="h-3 bg-muted rounded animate-pulse w-1/2 mt-1.5" /></td>
                          <td className="p-3"><div className="h-4 bg-muted rounded animate-pulse w-20" /></td>
                          <td className="p-3"><div className="h-4 bg-muted rounded animate-pulse w-24" /></td>
                          <td className="p-3"><div className="flex gap-1"><div className="h-5 bg-muted rounded animate-pulse w-14" /><div className="h-5 bg-muted rounded animate-pulse w-16" /></div></td>
                          <td className="p-3 hidden xl:table-cell"><div className="h-5 bg-muted rounded-full animate-pulse w-20" /></td>
                          <td className="p-3"><div className="h-5 bg-muted rounded animate-pulse w-20" /></td>
                          <td className="p-3 hidden xl:table-cell"><div className="h-4 bg-muted rounded animate-pulse w-16" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="lg:hidden divide-y divide-border">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="p-4">
                      <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
                      <div className="h-3 bg-muted rounded animate-pulse w-1/2 mt-2" />
                      <div className="flex gap-2 mt-3">
                        <div className="h-5 bg-muted rounded animate-pulse w-20" />
                        <div className="h-5 bg-muted rounded-full animate-pulse w-16" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <div className="text-4xl mb-3">🔍</div>
                <p className="font-medium text-foreground">
                  {showFavoritesOnly ? 'Brak ulubionych ofert' : 'Nie znaleziono ofert'}
                </p>
                <p className="text-sm mt-1">
                  {showFavoritesOnly
                    ? 'Kliknij serduszko na ofercie aby dodać ją do ulubionych'
                    : 'Spróbuj zmienić kryteria wyszukiwania'}
                </p>
              </div>
            ) : (
              <JobTable
                jobs={jobs}
                total={total}
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
                onFavoritesChange={handleFavoritesChange}
              />
            )}
          </section>
        </div>
      </main>

      {/* Mobile filters drawer */}
      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileFiltersOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-80 max-w-[85vw] bg-background shadow-xl overflow-y-auto">
            <div className="flex items-center justify-end p-4 border-b border-border">
              <button
                onClick={() => setMobileFiltersOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-muted transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              <Filters onFilter={(f) => { handleFilter(f); setMobileFiltersOpen(false); }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
