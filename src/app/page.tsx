'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { SearchBar } from '@/components/SearchBar';
import { Filters, FilterState } from '@/components/Filters';
import { JobTable } from '@/components/JobTable';
import { Button } from '@/components/ui/button';
import type { Job, GroupedJob } from '@/types/job';

export default function Home() {
  const [jobs, setJobs] = useState<(Job | GroupedJob)[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
const [filters, setFilters] = useState<FilterState>({
  city: '',
  technology: '',
  workMode: [], // Empty array means all work modes selected
  salaryMin: '',
  salaryMax: '',
  company: '',
  publishedAfter: '',
  sources: [], // Empty array means all sources selected
});
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{ total: number; bySource: { source: string; count: number }[]; lastSync: string | null; todayNew: number } | null>(null);

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

      const res = await fetch(`/api/jobs?${params.toString()}`);
      if (!res.ok) throw new Error(`Błąd serwera: ${res.status}`);
      const data = await res.json();
      setJobs(data.jobs);
      setTotal(data.pagination.total);
      setTotalPages(data.pagination.totalPages);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się załadować danych');
    } finally {
      setLoading(false);
    }
  }, [page, search, filters]);

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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="bg-card border-b border-border">
        <div className="max-w-[1400px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-2xl font-bold tracking-tight font-[family-name:var(--font-geist-sans)] whitespace-nowrap">WorkFinder</h1>
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
            <Button onClick={handleSync} disabled={syncing} variant="outline" size="sm">
              <svg className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                <polyline points="21 3 21 9 15 9" />
              </svg>
              {syncing ? 'Odświeżanie...' : 'Odśwież'}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto p-6">
        <div className="flex gap-6">
          <aside className="w-60 flex-shrink-0 hidden lg:block sticky top-4 self-start">
            <Filters onFilter={handleFilter} />
          </aside>

          <section className="flex-1 min-w-0">
            <div className="mb-4">
              <SearchBar onSearch={handleSearch} />
            </div>

            {error && (
              <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-sm">
                {error}
              </div>
            )}
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />
                ))}
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <div className="text-4xl mb-3">🔍</div>
                <p className="font-medium text-foreground">Nie znaleziono ofert</p>
                <p className="text-sm mt-1">Spróbuj zmienić kryteria wyszukiwania</p>
              </div>
            ) : (
              <JobTable
                jobs={jobs}
                total={total}
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
