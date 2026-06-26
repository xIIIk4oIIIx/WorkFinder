'use client';

import { useState, useEffect } from 'react';
import { DualRangeSlider } from './DualRangeSlider';

const STORAGE_KEY_FILTERS = 'workfinder-filters';
const STORAGE_KEY_SECTIONS = 'workfinder-filter-sections';

function loadFilters(): FilterState {
  if (typeof window === 'undefined') return DEFAULT_FILTERS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY_FILTERS);
    return stored ? { ...DEFAULT_FILTERS, ...JSON.parse(stored) } : DEFAULT_FILTERS;
  } catch {
    return DEFAULT_FILTERS;
  }
}

function saveFilters(filters: FilterState) {
  localStorage.setItem(STORAGE_KEY_FILTERS, JSON.stringify(filters));
}

function loadSections(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem(STORAGE_KEY_SECTIONS);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveSections(sections: Record<string, boolean>) {
  localStorage.setItem(STORAGE_KEY_SECTIONS, JSON.stringify(sections));
}

function FilterSection({ title, sectionKey, defaultOpen = true, sections, onToggle, children }: {
  title: string;
  sectionKey: string;
  defaultOpen?: boolean;
  sections: Record<string, boolean>;
  onToggle: (key: string) => void;
  children: React.ReactNode;
}) {
  const open = sections[sectionKey] ?? defaultOpen;
  return (
    <div className="pb-3 border-b border-border last:border-b-0 last:pb-0">
      <button
        onClick={() => onToggle(sectionKey)}
        className="w-full flex items-center justify-between text-[10px] font-[family-name:var(--font-mono)] font-semibold uppercase tracking-widest text-muted-foreground mb-2 hover:text-foreground transition-colors"
      >
        {title}
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      <div suppressHydrationWarning style={{ maxHeight: open ? '500px' : '0', opacity: open ? 1 : 0, overflow: open ? 'visible' : 'hidden', transition: 'max-height 250ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms ease' }}>
        {children}
      </div>
    </div>
  );
}

interface FiltersProps {
  onFilter: (filters: FilterState) => void;
}

export interface FilterState {
  city: string;
  technology: string;
  workMode: string[];
  salaryMin: string;
  salaryMax: string;
  company: string;
  publishedAfter: string;
  sources: string[];
  excludeSources: string[];
}

const AVAILABLE_SOURCES = [
  { id: 'nofluffjobs', label: 'NoFluffJobs', color: 'bg-accent' },
  { id: 'bulldogjob', label: 'BulldogJob', color: 'bg-blue-500' },
  { id: 'olx', label: 'OLX', color: 'bg-amber-500' },
  { id: 'justjoin', label: 'JustJoin', color: 'bg-blue-500' },
  { id: 'rocketjobs', label: 'RocketJobs', color: 'bg-accent' },
  { id: 'jooble', label: 'Jooble', color: 'bg-emerald-500' },
  { id: 'pracuj', label: 'Pracuj.pl', color: 'bg-rose-500' },
];

const WORK_MODE_OPTIONS = [
  { id: 'remote', label: 'Zdalnie', color: 'bg-emerald-500' },
  { id: 'office', label: 'Stacjonarnie', color: 'bg-slate-400' },
  { id: 'hybrid', label: 'Hybrydowo', color: 'bg-amber-500' },
];

const DEFAULT_FILTERS: FilterState = {
  city: '',
  technology: '',
  workMode: [],
  salaryMin: '',
  salaryMax: '',
  company: '',
  publishedAfter: '',
  sources: [],
  excludeSources: [],
};

const DEFAULT_SECTIONS: Record<string, boolean> = {
  lokalizacja: false,
  zarobki: false,
  zrodla: false,
};

export function Filters({ onFilter }: FiltersProps) {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [sections, setSections] = useState<Record<string, boolean>>(DEFAULT_SECTIONS);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setFilters(loadFilters());
    setSections(loadSections());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) saveFilters(filters);
  }, [filters, mounted]);

  useEffect(() => {
    if (mounted) saveSections(sections);
  }, [sections, mounted]);

  const handleChange = (key: keyof FilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleSourceToggle = (sourceId: string) => {
    setFilters((prev) => {
      const isIncluded = prev.sources.includes(sourceId);
      const isExcluded = prev.excludeSources.includes(sourceId);

      if (isIncluded) {
        return {
          ...prev,
          sources: prev.sources.filter((s) => s !== sourceId),
          excludeSources: [...prev.excludeSources, sourceId],
        };
      } else if (isExcluded) {
        return {
          ...prev,
          excludeSources: prev.excludeSources.filter((s) => s !== sourceId),
        };
      } else {
        return {
          ...prev,
          sources: [...prev.sources, sourceId],
        };
      }
    });
  };

  const handleWorkModeToggle = (workMode: string) => {
    setFilters((prev) => {
      const next = prev.workMode.includes(workMode)
        ? prev.workMode.filter((m) => m !== workMode)
        : [...prev.workMode, workMode];
      return { ...prev, workMode: next };
    });
  };

  const handleSectionToggle = (key: string) => {
    setSections((prev) => ({ ...prev, [key]: !(prev[key] ?? DEFAULT_SECTIONS[key]) }));
  };

  const handleClear = () => {
    setFilters(DEFAULT_FILTERS);
    setSections(DEFAULT_SECTIONS);
    onFilter(DEFAULT_FILTERS);
  };

  const handleApply = () => {
    onFilter(filters);
  };

  return (
    <div className="bg-muted border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold tracking-tight flex items-center gap-2">
          Filtry
          {(filters.workMode.length > 0 || filters.sources.length > 0 || filters.excludeSources.length > 0 || filters.city || filters.company || filters.salaryMin || filters.salaryMax) && (
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-accent text-accent-foreground" style={{ animation: 'badge-pop 300ms cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
              {filters.workMode.length + filters.sources.length + filters.excludeSources.length + (filters.city ? 1 : 0) + (filters.company ? 1 : 0) + (filters.salaryMin ? 1 : 0) + (filters.salaryMax ? 1 : 0)}
            </span>
          )}
        </h3>
        <button
          onClick={handleClear}
          className="text-[11px] font-[family-name:var(--font-mono)] text-muted-foreground hover:text-foreground underline underline-offset-2 transition-all duration-150 active:scale-95"
        >
          Wyczyść wszystkie
        </button>
      </div>

      <div className="space-y-4">
        <div className="pb-3 border-b border-border">
          <div className="text-[10px] font-[family-name:var(--font-mono)] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Praca</div>
          <div className="flex flex-wrap gap-1.5">
            {WORK_MODE_OPTIONS.map((mode) => (
              <button
                key={mode.id}
                onClick={() => handleWorkModeToggle(mode.id)}
                className={`inline-flex items-center gap-1.5 text-[11px] font-[family-name:var(--font-mono)] font-medium px-2.5 py-1 rounded-md border transition-all duration-150 active:scale-95 ${
                  filters.workMode.includes(mode.id)
                    ? 'border-accent/30 bg-accent/10 text-accent'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${mode.id === 'remote' ? 'bg-emerald-500' : mode.id === 'office' ? 'bg-slate-400' : 'bg-amber-500'}`} />
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        <FilterSection title="Lokalizacja" sectionKey="lokalizacja" defaultOpen={false} sections={sections} onToggle={handleSectionToggle}>
          <div className="flex gap-2">
            <input
              type="text"
              value={filters.city}
              onChange={(e) => handleChange('city', e.target.value)}
              placeholder="Miasto"
              className="flex-1 min-w-0 px-3 py-1.5 border border-border rounded-md bg-card text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-foreground transition-colors"
            />
            <input
              type="text"
              value={filters.company}
              onChange={(e) => handleChange('company', e.target.value)}
              placeholder="Firma"
              className="flex-1 min-w-0 px-3 py-1.5 border border-border rounded-md bg-card text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-foreground transition-colors"
            />
          </div>
        </FilterSection>

        <FilterSection title="Zarobki" sectionKey="zarobki" defaultOpen={false} sections={sections} onToggle={handleSectionToggle}>
          <div className="space-y-2">
            <DualRangeSlider
              min={0}
              max={100000}
              step={1000}
              value={[
                filters.salaryMin !== '' ? parseInt(filters.salaryMin) : 0,
                filters.salaryMax !== '' ? parseInt(filters.salaryMax) : 100000,
              ]}
              onChange={([min, max]) => {
                setFilters((prev) => ({ ...prev, salaryMin: min.toString(), salaryMax: max.toString() }));
              }}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{filters.salaryMin !== '' ? `${parseInt(filters.salaryMin).toLocaleString('pl-PL')} PLN` : '0 PLN'}</span>
              <span>{filters.salaryMax !== '' ? `${parseInt(filters.salaryMax).toLocaleString('pl-PL')} PLN` : '100k PLN'}</span>
            </div>
          </div>
        </FilterSection>

        <FilterSection title="Źródła" sectionKey="zrodla" defaultOpen={false} sections={sections} onToggle={handleSectionToggle}>
          <div className="flex flex-wrap gap-1.5">
            {AVAILABLE_SOURCES.map((source) => {
              const isIncluded = filters.sources.includes(source.id);
              const isExcluded = filters.excludeSources.includes(source.id);
              return (
                <button
                  key={source.id}
                  onClick={() => handleSourceToggle(source.id)}
                  className={`inline-flex items-center gap-1.5 text-[11px] font-[family-name:var(--font-mono)] font-medium px-2.5 py-1 rounded-md border transition-all duration-150 active:scale-95 ${
                    isIncluded
                      ? 'border-accent/30 bg-accent/10 text-accent'
                      : isExcluded
                        ? 'border-destructive/30 bg-destructive/10 text-destructive'
                        : 'border-border bg-card text-muted-foreground hover:bg-muted'
                  }`}
                >
                <span className={`w-1.5 h-1.5 rounded-full ${source.color}`} />
                {source.label}
              </button>
              );
            })}
          </div>
        </FilterSection>
      </div>

      <button
        onClick={handleApply}
        className="w-full mt-4 px-4 py-2 bg-accent text-accent-foreground rounded-md text-sm font-medium hover:bg-accent/90 active:scale-[0.98] transition-all duration-150 shadow-md shadow-accent/20"
      >
        Filtruj
      </button>
    </div>
  );
}
