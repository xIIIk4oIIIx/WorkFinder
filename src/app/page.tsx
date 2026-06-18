'use client';

import { useState, useEffect, useCallback } from 'react';
import { SearchBar } from '@/components/SearchBar';
import { Filters, FilterState } from '@/components/Filters';
import { JobTable } from '@/components/JobTable';

interface Job {
  id: string;
  title: string;
  company: string;
  city: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  technologies: string[];
  workMode: string | null;
  source: string;
  sourceUrl: string;
  publishedAt: string | null;
}

export default function Home() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<FilterState>({
    city: '',
    technology: '',
    workMode: '',
    salaryMin: '',
    salaryMax: '',
    company: '',
    publishedAfter: '',
  });
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', '25');
    if (search) params.set('search', search);
    if (filters.city) params.set('city', filters.city);
    if (filters.technology) params.set('technology', filters.technology);
    if (filters.workMode) params.set('workMode', filters.workMode);
    if (filters.salaryMin) params.set('salaryMin', filters.salaryMin);
    if (filters.salaryMax) params.set('salaryMax', filters.salaryMax);
    if (filters.company) params.set('company', filters.company);
    if (filters.publishedAfter) params.set('publishedAfter', filters.publishedAfter);

    const res = await fetch(`/api/jobs?${params.toString()}`);
    const data = await res.json();
    setJobs(data.jobs);
    setTotal(data.pagination.total);
    setTotalPages(data.pagination.totalPages);
    setLoading(false);
  }, [page, search, filters]);

  useEffect(() => {
    fetchJobs();
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
    setSyncing(false);
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-gray-900 text-white p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold">WorkFinder</h1>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {syncing ? 'Odświeżanie...' : 'Odśwież dane'}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4">
        <div className="mb-4">
          <SearchBar onSearch={handleSearch} />
        </div>

        <div className="flex gap-6">
          <aside className="w-64 flex-shrink-0">
            <Filters onFilter={handleFilter} />
          </aside>

          <section className="flex-1">
            {loading ? (
              <div className="text-center py-8">Ładowanie...</div>
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
