'use client';

import { useState } from 'react';
import { DualRangeSlider } from './DualRangeSlider';

function FilterSection({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="pb-3 border-b border-border last:border-b-0 last:pb-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between text-[10px] font-[family-name:var(--font-mono)] font-semibold uppercase tracking-widest text-muted-foreground mb-2 hover:text-foreground transition-colors"
      >
        {title}
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && children}
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
}

const AVAILABLE_SOURCES = [
  { id: 'nofluffjobs', label: 'NoFluffJobs', color: 'bg-accent' },
  { id: 'bulldogjob', label: 'BulldogJob', color: 'bg-blue-500' },
  { id: 'olx', label: 'OLX', color: 'bg-orange-500' },
  { id: 'justjoin', label: 'JustJoin', color: 'bg-violet-500' },
  { id: 'rocketjobs', label: 'RocketJobs', color: 'bg-cyan-500' },
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
  workMode: [], // Empty array means all work modes selected
  salaryMin: '',
  salaryMax: '',
  company: '',
  publishedAfter: '',
  sources: [], // Empty array means all sources selected
};

export function Filters({ onFilter }: FiltersProps) {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  const handleChange = (key: keyof FilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleSourceToggle = (sourceId: string) => {
    setFilters((prev) => {
      const next = prev.sources.includes(sourceId)
        ? prev.sources.filter((s) => s !== sourceId)
        : [...prev.sources, sourceId];
      return { ...prev, sources: next };
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

  const handleClear = () => {
    setFilters(DEFAULT_FILTERS);
    onFilter(DEFAULT_FILTERS);
  };

  const handleApply = () => {
    onFilter(filters);
  };

  return (
    <div className="bg-muted border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold tracking-tight">Filtry</h3>
        <button
          onClick={handleClear}
          className="text-[11px] font-[family-name:var(--font-mono)] text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
        >
          Wyczyść wszystkie
        </button>
      </div>

      <div className="space-y-4">
        <FilterSection title="Lokalizacja">
          <div className="space-y-2">
            <input
              type="text"
              value={filters.city}
              onChange={(e) => handleChange('city', e.target.value)}
              placeholder="Miasto"
              className="w-full px-3 py-1.5 border border-border rounded-md bg-card text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-foreground transition-colors"
            />
            <input
              type="text"
              value={filters.company}
              onChange={(e) => handleChange('company', e.target.value)}
              placeholder="Firma"
              className="w-full px-3 py-1.5 border border-border rounded-md bg-card text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-foreground transition-colors"
            />
          </div>
        </FilterSection>

        <FilterSection title="Technologia">
          <input
            type="text"
            value={filters.technology}
            onChange={(e) => handleChange('technology', e.target.value)}
            placeholder="np. React, Node.js"
            className="w-full px-3 py-1.5 border border-border rounded-md bg-card text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-foreground transition-colors"
          />
        </FilterSection>

        <FilterSection title="Praca">
          <div className="flex flex-wrap gap-1.5">
            {WORK_MODE_OPTIONS.map((mode) => (
              <button
                key={mode.id}
                onClick={() => handleWorkModeToggle(mode.id)}
                className={`inline-flex items-center gap-1.5 text-[11px] font-[family-name:var(--font-mono)] font-medium px-2.5 py-1 rounded-md border transition-colors ${
                  filters.workMode.includes(mode.id)
                    ? 'border-accent/30 bg-accent/10 text-accent'
                    : 'border-border bg-card text-muted-foreground'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${mode.id === 'remote' ? 'bg-emerald-500' : mode.id === 'office' ? 'bg-slate-400' : 'bg-amber-500'}`} />
                {mode.label}
              </button>
            ))}
          </div>
        </FilterSection>

        <FilterSection title="Zarobki">
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

        <FilterSection title="Źródła">
          <div className="flex flex-wrap gap-1.5">
            {AVAILABLE_SOURCES.map((source) => (
              <button
                key={source.id}
                onClick={() => handleSourceToggle(source.id)}
                className={`inline-flex items-center gap-1.5 text-[11px] font-[family-name:var(--font-mono)] font-medium px-2.5 py-1 rounded-md border transition-colors ${
                  filters.sources.includes(source.id)
                    ? 'border-accent/30 bg-accent/10 text-accent'
                    : 'border-border bg-card text-muted-foreground'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${source.color}`} />
                {source.label}
              </button>
            ))}
          </div>
        </FilterSection>
      </div>

      <button
        onClick={handleApply}
        className="w-full mt-4 px-4 py-2 bg-accent text-accent-foreground rounded-md text-sm font-medium hover:bg-accent/90 transition-colors"
      >
        Filtruj
      </button>
    </div>
  );
}
