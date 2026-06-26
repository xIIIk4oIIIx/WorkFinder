'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { SearchBar } from '@/components/SearchBar';
import { Filters, FilterState, loadFilters } from '@/components/Filters';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { JobTable } from '@/components/JobTable';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useJobs, loadJobsCache, type JobsResponse } from '@/hooks/useJobs';
import { useJobsPrefetch } from '@/hooks/useJobsPrefetch';
import { useStats, loadStatsCache, type Stats } from '@/hooks/useStats';
import { type PreferenceState, getPreferences, sortJobsByPreference } from '@/lib/preferences';

function getFavorites(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const stored = localStorage.getItem('workfinder-favorites');
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card/80 backdrop-blur-md border-b border-border">
        <div className="max-w-[1200px] mx-auto px-4 lg:px-8 py-3 lg:py-4">
          <div className="flex items-center justify-between">
            <div className="h-6 w-32 bg-muted rounded animate-pulse" />
            <div className="flex items-center gap-3">
              <div className="h-5 w-20 bg-muted rounded animate-pulse" />
              <div className="h-5 w-16 bg-muted rounded animate-pulse" />
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-[1200px] mx-auto px-4 lg:px-8 py-6 lg:py-8">
        <div className="flex gap-8">
          <aside className="w-64 hidden lg:block">
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          </aside>
          <section className="flex-1">
            <div className="flex gap-3 mb-6">
              <div className="h-10 w-24 bg-muted rounded-lg animate-pulse" />
              <div className="h-10 w-28 bg-muted rounded-lg animate-pulse" />
              <div className="flex-1 h-10 bg-muted rounded-lg animate-pulse" />
            </div>
            <div className="border border-border rounded-lg bg-card">
              <div className="divide-y divide-border">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="p-4">
                    <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
                    <div className="h-3 bg-muted rounded animate-pulse w-1/2 mt-2" />
                    <div className="flex gap-2 mt-3">
                      <div className="h-5 bg-muted rounded animate-pulse w-24" />
                      <div className="h-5 bg-muted rounded-full animate-pulse w-20" />
                      <div className="h-5 bg-muted rounded-md animate-pulse w-16" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </main>
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

  if (!ready) return <LoadingSkeleton />;

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
  const [filters, setFilters] = useState<FilterState>(loadFilters);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(initialFavorites);
  const [preferences, setPreferences] = useState<PreferenceState>(getPreferences());
  const [syncing, setSyncing] = useState(false);
  const [syncElapsed, setSyncElapsed] = useState(0);
  const syncTimerRef = useRef<NodeJS.Timeout | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const isDrawerOpen = useRef(false);
  const tableSectionRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
    const header = headerRef.current;
    const section = tableSectionRef.current;
    if (header && section) {
      const headerTop = header.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: headerTop, behavior: 'smooth' });
    }
  }, []);

  const openDrawer = useCallback(() => {
    if (isDrawerOpen.current) return;
    isDrawerOpen.current = true;
    setMobileFiltersOpen(true);

    requestAnimationFrame(() => {
      if (!overlayRef.current || !panelRef.current) return;
      const panel = panelRef.current;

      panel.style.transition = 'none';
      panel.style.transform = 'translate3d(-100%,0,0) scale(0.95)';
      panel.style.boxShadow = 'none';
      panel.style.opacity = '0.8';
        overlayRef.current.style.backgroundColor = 'rgba(0,0,0,0)';
        overlayRef.current.style.backdropFilter = 'blur(0px)';
      overlayRef.current.offsetHeight;

      requestAnimationFrame(() => {
        panel.style.transition = 'transform 225ms cubic-bezier(0.0, 0.0, 0.2, 1), box-shadow 225ms cubic-bezier(0.0, 0.0, 0.2, 1), opacity 200ms ease-out';
        overlayRef.current!.style.transition = 'background-color 225ms cubic-bezier(0.0, 0.0, 0.2, 1), backdrop-filter 225ms cubic-bezier(0.0, 0.0, 0.2, 1)';
        panel.style.transform = 'translate3d(0,0,0) scale(1)';
        panel.style.boxShadow = '8px 0 40px rgba(0,0,0,0.25)';
        panel.style.opacity = '1';
        overlayRef.current!.style.backgroundColor = 'rgba(0,0,0,0.5)';
        overlayRef.current!.style.backdropFilter = 'blur(4px)';
      });
    });
  }, []);

  const closeDrawer = useCallback(() => {
    if (!isDrawerOpen.current) return;
    isDrawerOpen.current = false;

    if (!overlayRef.current || !panelRef.current) {
      setMobileFiltersOpen(false);
      return;
    }

    const panel = panelRef.current;
    const overlay = overlayRef.current;

    panel.style.transition = 'none';
    overlay.style.transition = 'none';
    panel.offsetHeight;

    requestAnimationFrame(() => {
      panel.style.transition = 'transform 195ms cubic-bezier(0.4, 0.0, 1, 1), box-shadow 195ms cubic-bezier(0.4, 0.0, 1, 1), opacity 150ms ease-in';
      overlay.style.transition = 'background-color 195ms cubic-bezier(0.4, 0.0, 1, 1), backdrop-filter 195ms cubic-bezier(0.4, 0.0, 1, 1)';
      panel.style.transform = 'translate3d(-100%,0,0) scale(0.95)';
      panel.style.boxShadow = 'none';
      panel.style.opacity = '0.8';
      overlay.style.backgroundColor = 'rgba(0,0,0,0)';
      overlay.style.backdropFilter = 'blur(0px)';
    });

    setTimeout(() => setMobileFiltersOpen(false), 200);
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

  useJobsPrefetch(page, debouncedSearch, filters, showFavoritesOnly, favorites, totalPages);

  const sortedJobs = useMemo(() => sortJobsByPreference(jobs, preferences), [jobs, preferences]);

  useEffect(() => {
    return () => {
      // Clear interval is handled in handleSync finally block
    };
  }, []);

  if (total === 0 && isLoading) return <LoadingSkeleton />;

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
      const res = await fetch('/api/sync', { method: 'POST' });
      if (!res.ok) throw new Error(`Sync failed: ${res.status}`);
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
      <header ref={headerRef} className="relative bg-card/80 backdrop-blur-md border-b border-border">
        <div className="max-w-[1280px] mx-auto px-4 lg:px-8 py-3 lg:py-4">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-xl lg:text-2xl font-bold tracking-tight font-[family-name:var(--font-sans)] whitespace-nowrap">
              <span className="bg-gradient-to-r from-accent to-accent/60 bg-clip-text text-transparent">Work</span>Finder
            </h1>

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

            <div className="hidden md:flex items-center gap-3">
              <div className="stats-pop-in border border-border rounded-lg px-4 py-2.5 bg-background/50 backdrop-blur-sm" style={{ animationDelay: '0ms' }}>
                <div suppressHydrationWarning className="text-xl font-semibold tracking-tight font-[family-name:var(--font-sans)]"><AnimatedNumber value={total} /></div>
                <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Łącznie</div>
              </div>
              <div className="stats-pop-in border border-accent/20 rounded-lg px-4 py-2.5 bg-accent/5" style={{ animationDelay: '100ms' }}>
                <div suppressHydrationWarning className="text-xl font-semibold tracking-tight font-[family-name:var(--font-sans)] text-accent">+<AnimatedNumber value={stats?.todayNew ?? 0} /></div>
                <div className="text-[10px] text-accent/70 font-medium uppercase tracking-wider">Dziś</div>
              </div>
              <div className="h-8 w-px bg-border" />
              <div className="text-xs text-muted-foreground">
                <span className="font-medium">{stats?.bySource?.length ?? 0}</span> źródeł
              </div>
              <div className="text-xs text-muted-foreground">
                Odświeżono: <span className="font-[family-name:var(--font-mono)] font-medium">{stats?.lastSync ? new Date(stats.lastSync).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button onClick={handleSync} disabled={syncing} variant="outline" size="sm" className="active:scale-95 transition-all duration-150">
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
          <div className="absolute bottom-0 left-0 h-[3px] bg-accent z-10 transition-all duration-1000 ease-linear" style={{ width: `${Math.min((syncElapsed / 30) * 100, 95)}%`, boxShadow: '0 0 2px var(--accent)' }} />
        )}
      </header>

      <main id="main-content" className="max-w-[1280px] mx-auto px-4 lg:px-8 py-6 lg:py-8">
        <div className="mb-6">
          <p className="text-muted-foreground text-sm">Przeglądaj oferty pracy w jednym miejscu</p>
        </div>
        <div className="flex gap-8">
          <aside className="w-64 flex-shrink-0 hidden lg:block sticky top-6 self-start">
            <Filters onFilter={handleFilter} />
          </aside>

          <section ref={tableSectionRef} className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={openDrawer}
                className="lg:hidden flex items-center gap-2 px-3 py-2 border border-border rounded-md bg-card text-foreground text-sm font-medium hover:bg-muted active:scale-95 transition-all duration-150"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="4" x2="4" y1="21" y2="14" /><line x1="4" x2="4" y1="10" y2="3" />
                  <line x1="12" x2="12" y1="21" y2="12" /><line x1="12" x2="12" y1="8" y2="3" />
                  <line x1="20" x2="20" y1="21" y2="16" /><line x1="20" x2="20" y1="12" y2="3" />
                </svg>
                Filtry
              </button>
              <button
                onClick={() => { setShowFavoritesOnly(!showFavoritesOnly); handlePageChange(1); }}
                className={`flex items-center gap-2 px-3 py-2 border rounded-md text-sm font-medium transition-all duration-150 active:scale-95 ${
                  showFavoritesOnly
                    ? 'border-rose-500/30 bg-rose-500/15 text-rose-400 light:border-rose-300 light:bg-rose-50 light:text-rose-600'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill={showFavoritesOnly ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                </svg>
                <span className="hidden sm:inline">Ulubione</span>
                {favorites.size > 0 && (
                    <span className="text-[10px] bg-rose-500/15 text-rose-400 light:bg-rose-100 light:text-rose-600 px-1.5 py-0.5 rounded-full font-medium">
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
              <div className="text-center py-20 px-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                  <svg className="w-8 h-8 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                    {showFavoritesOnly && <path d="M8 11h6" />}
                  </svg>
                </div>
                <p className="font-medium text-foreground text-lg">
                  {showFavoritesOnly ? 'Brak ulubionych ofert' : 'Nie znaleziono ofert'}
                </p>
                <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
                  {showFavoritesOnly
                    ? 'Kliknij ikonę serca na ofercie, aby dodać ją do ulubionych'
                    : 'Spróbuj zmienić kryteria wyszukiwania lub rozszerzyć zakres filtrów'}
                </p>
              </div>
            ) : (
              <JobTable
                jobs={sortedJobs}
                total={total}
                page={page}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                onFavoritesChange={handleFavoritesChange}
                preferences={preferences}
                onPreferenceChange={setPreferences}
              />
            )}
          </section>
        </div>
      </main>

      <footer className="border-t border-border mt-8">
        <div className="max-w-[1280px] mx-auto px-4 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">WorkFinder</span>
              <span>&copy; 2026</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>Źródła:</span>
              {['NoFluffJobs', 'BulldogJob', 'OLX', 'JustJoin', 'RocketJobs', 'Jooble', 'Pracuj.pl'].map((s) => (
                <span key={s} className="footer-source hover:text-foreground cursor-default">{s}</span>
              ))}
            </div>
          </div>
        </div>
      </footer>

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
            backdropFilter: 'blur(0px)',
            transition: 'background-color 180ms cubic-bezier(0.4, 0, 0.2, 1), backdrop-filter 180ms cubic-bezier(0.4, 0, 0.2, 1)',
            willChange: 'background-color, backdrop-filter',
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