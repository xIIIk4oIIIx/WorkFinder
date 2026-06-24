'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { SearchBar } from '@/components/SearchBar';
import { Filters, FilterState } from '@/components/Filters';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { JobTable } from '@/components/JobTable';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useJobs, loadJobsCache, type JobsResponse } from '@/hooks/useJobs';
import { useStats, loadStatsCache, type Stats } from '@/hooks/useStats';

function getFavorites(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const stored = localStorage.getItem('workfinder-favorites');
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

function LoadingSpinner() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white dark:bg-background">
      <div className="flex flex-col items-center gap-4">
        <svg className="w-10 h-10 animate-spin text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          <polyline points="21 3 21 9 15 9" />
        </svg>
        <p className="text-sm text-muted-foreground font-medium">Ładowanie...</p>
      </div>
    </div>
  );
}

export default function Home() {
  const [ready, setReady] = useState(false);
  const [initialCache, setInitialCache] = useState<{
    stats?: Stats;
    jobs?: Record<string, JobsResponse>;
    favorites: Set<string>;
  }>({ favorites: new Set() });

useEffect(() => {
    // Load initial cache
    const statsCache = loadStatsCache();
    
    // For jobs, we need to load the cache for the current URL
    // Since we don't have the URL params yet, we'll pass undefined initially
    // and let the useJobs hook handle it
    setInitialCache({
      stats: statsCache,
      favorites: getFavorites()
    });
    setReady(true);
  }, []);

  if (!ready) return <LoadingSpinner />;

  return <HomeContent initialStats={initialCache.stats} initialFavorites={initialCache.favorites} />;
}

interface HomeContentProps {
  initialStats?: Stats;
  initialFavorites: Set<string>;
}

function HomeContent({ initialStats, initialFavorites }: HomeContentProps) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filters, setFilters] = useState<FilterState>({
    city: '',
    technology: '',
    workMode: [],
    salaryMin: '',
    salaryMax: '',
    company: '',
    publishedAfter: '',
    sources: [],
    excludeSources: [],
  });
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(initialFavorites);
  const [syncing, setSyncing] = useState(false);
  const [syncElapsed, setSyncElapsed] = useState(0);
  const syncTimerRef = useRef<NodeJS.Timeout | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const isDrawerOpen = useRef(false);

  const openDrawer = useCallback(() => {
    if (isDrawerOpen.current) return;
    isDrawerOpen.current = true;
    setMobileFiltersOpen(true);

    requestAnimationFrame(() => {
      if (!overlayRef.current || !panelRef.current) return;
      overlayRef.current.style.backgroundColor = 'rgba(0,0,0,0.5)';
      panelRef.current.style.transform = 'translate3d(0,0,0) scale(1)';
      panelRef.current.style.boxShadow = '8px 0 40px rgba(0,0,0,0.25)';
      panelRef.current.style.opacity = '1';
    });
  }, []);

  const closeDrawer = useCallback(() => {
    if (!isDrawerOpen.current) return;
    isDrawerOpen.current = false;

    if (!overlayRef.current || !panelRef.current) {
      setMobileFiltersOpen(false);
      return;
    }

    overlayRef.current.style.backgroundColor = 'rgba(0,0,0,0)';
    panelRef.current.style.transform = 'translate3d(-100%,0,0) scale(0.95)';
    panelRef.current.style.boxShadow = 'none';
    panelRef.current.style.opacity = '0.8';

    setTimeout(() => setMobileFiltersOpen(false), 300);
  }, []);

  useEffect(() => {
    const handleStorageChange = () => setFavorites(getFavorites());
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  const { jobs, total, totalPages, isLoading, error, mutate: mutateJobs } = useJobs(
    page, debouncedSearch, filters, showFavoritesOnly, favorites
  );
  const { stats, mutate: mutateStats } = useStats(initialStats);

  useEffect(() => {
    return () => { 
      // Clear interval is handled in handleSync finally block
    };
  }, []);

  if (total === 0 && isLoading) return <LoadingSpinner />;

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
    setSyncElapsed(0);
    const startTime = Date.now();
    const interval = setInterval(() => {
      setSyncElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    
    try {
      await fetch('/api/sync', { method: 'POST' });
      await Promise.all([mutateJobs(), mutateStats()]);
    } finally {
      clearInterval(interval);
      setSyncing(false);
    }
  };

  const handleFavoritesChange = () => {
    setFavorites(getFavorites());
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="relative bg-card border-b border-border">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-6 py-3 lg:py-4">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-xl lg:text-2xl font-bold tracking-tight font-[family-name:var(--font-geist-sans)] whitespace-nowrap">WorkFinder</h1>

            <div className="flex md:hidden items-center gap-3 text-xs">
              <div className="flex items-center gap-1">
                <span suppressHydrationWarning className="font-bold text-foreground"><AnimatedNumber value={total} /></span>
                <span className="text-muted-foreground">ofert</span>
              </div>
              <div className="w-px h-3 bg-border" />
              <div className="flex items-center gap-1">
                <span suppressHydrationWarning className="font-bold text-accent">+<AnimatedNumber value={stats?.todayNew ?? 0} /></span>
                <span className="text-muted-foreground">dziś</span>
              </div>
            </div>

            <div className="hidden md:grid grid-cols-4 gap-3">
              <div className="border border-border rounded-lg px-4 py-3 bg-background">
                <div suppressHydrationWarning className="text-2xl font-bold tracking-tight font-[family-name:var(--font-geist-sans)]"><AnimatedNumber value={total} /></div>
                <div className="text-xs text-muted-foreground font-medium">Łącznie ofert</div>
              </div>
              <div className="border border-border rounded-lg px-4 py-3 bg-background">
                <div suppressHydrationWarning className="text-2xl font-bold tracking-tight font-[family-name:var(--font-geist-sans)] text-accent">+<AnimatedNumber value={stats?.todayNew ?? 0} /></div>
                <div className="text-xs text-muted-foreground font-medium">Nowe dziś</div>
              </div>
              <div className="border border-border rounded-lg px-4 py-3 bg-background">
                <div suppressHydrationWarning className="text-2xl font-bold tracking-tight font-[family-name:var(--font-geist-sans)]"><AnimatedNumber value={stats?.bySource?.length ?? 0} /></div>
                <div className="text-xs text-muted-foreground font-medium">Aktywne źródła</div>
              </div>
              <div className="border border-border rounded-lg px-4 py-3 bg-background">
                <div suppressHydrationWarning className="text-2xl font-bold tracking-tight font-[family-name:var(--font-geist-sans)]">{stats?.lastSync ? new Date(stats.lastSync).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }) : '—'}</div>
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
        {syncing && (
          <div className="absolute bottom-0 left-0 h-[3px] bg-accent z-10 transition-all duration-1000 ease-linear" style={{ width: `${Math.min((syncElapsed / 30) * 100, 95)}%` }} />
        )}
      </header>

      <main className="max-w-[1400px] mx-auto p-4 lg:p-6">
        <div className="flex gap-6">
          <aside className="w-60 flex-shrink-0 hidden lg:block sticky top-4 self-start">
            <Filters onFilter={handleFilter} />
          </aside>

          <section className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={openDrawer}
                className="lg:hidden flex items-center gap-2 px-3 py-2 border border-border rounded-md bg-card text-foreground text-sm font-medium hover:bg-muted transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="4" x2="4" y1="21" y2="14" /><line x1="4" x2="4" y1="10" y2="3" />
                  <line x1="12" x2="12" y1="21" y2="12" /><line x1="12" x2="12" y1="8" y2="3" />
                  <line x1="20" x2="20" y1="21" y2="16" /><line x1="20" x2="20" y1="12" y2="3" />
                </svg>
                Filtry
              </button>
              <button
                onClick={() => { setShowFavoritesOnly(!showFavoritesOnly); setPage(1); }}
                className={`flex items-center gap-2 px-3 py-2 border rounded-md text-sm font-medium transition-colors ${
                  showFavoritesOnly
                    ? 'border-rose-300 bg-rose-50 text-rose-600'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted hover:bg-muted hover:text-foreground'
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
            {jobs.length === 0 && !isLoading ? (
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

      <div
        ref={drawerRef}
        className={`fixed inset-0 z-50 lg:hidden ${mobileFiltersOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
        style={{ perspective: '1200px' }}
      >
        {/* Overlay */}
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: 'rgba(0,0,0,0)',
            transition: 'background-color 180ms cubic-bezier(0.4, 0, 0.2, 1)',
            willChange: 'background-color',
          }}
          ref={overlayRef}
          onClick={closeDrawer}
        />
        {/* Drawer panel */}
        <div
          ref={panelRef}
          className="absolute inset-y-0 left-0 w-80 max-w-[85vw] bg-background overflow-y-auto"
          style={{
            transform: 'translate3d(-100%,0,0) scale(0.95)',
            transition: 'transform 240ms cubic-bezier(0.32, 0.72, 0, 1), box-shadow 240ms cubic-bezier(0.32, 0.72, 0, 1), opacity 180ms ease-out',
            willChange: 'transform, box-shadow, opacity',
            WebkitBackfaceVisibility: 'hidden',
            backfaceVisibility: 'hidden',
            boxShadow: 'none',
            opacity: '0.8',
          }}
        >
          <div className="flex items-center justify-end p-4 border-b border-border">
            <button
              onClick={closeDrawer}
              className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-muted transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" /><path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
          <div className="p-4">
            <Filters onFilter={(f) => { handleFilter(f); closeDrawer(); }} />
          </div>
        </div>
      </div>
    </div>
  );
}