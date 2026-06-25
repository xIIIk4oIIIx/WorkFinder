'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Job, GroupedJob, JobSource } from '@/types/job';
import { type PreferenceState } from '@/lib/preferences';
import { AiSummaryCard } from './AiSummaryCard';
import { JobCard } from './JobCard';

interface JobTableProps {
  jobs: (Job | GroupedJob)[];
  total: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onFavoritesChange?: () => void;
  preferences: PreferenceState;
  onPreferenceChange: (state: PreferenceState) => void;
}

const SOURCE_MAP: Record<string, { label: string; color: string }> = {
  nofluffjobs: { label: 'NoFluffJobs', color: 'bg-accent' },
  justjoin: { label: 'JustJoin', color: 'bg-blue-500' },
  bulldogjob: { label: 'BulldogJob', color: 'bg-blue-500' },
  olx: { label: 'OLX', color: 'bg-amber-500' },
  rocketjobs: { label: 'RocketJobs', color: 'bg-accent' },
  jooble: { label: 'Jooble', color: 'bg-emerald-500' },
  pracuj: { label: 'Pracuj.pl', color: 'bg-rose-500' },
};

const WORK_MODE_STYLES: Record<string, string> = {
  remote: 'bg-emerald-100 text-emerald-700',
  office: 'bg-slate-100 text-slate-600',
  hybrid: 'bg-amber-100 text-amber-700',
};

// Favorites helpers
function getFavorites(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const stored = localStorage.getItem('workfinder-favorites');
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

function toggleFavorite(jobId: string): Set<string> {
  const favorites = getFavorites();
  if (favorites.has(jobId)) {
    favorites.delete(jobId);
  } else {
    favorites.add(jobId);
  }
  localStorage.setItem('workfinder-favorites', JSON.stringify([...favorites]));
  return favorites;
}

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'przed chwilą';
  if (diffMins < 60) return `${diffMins} min temu`;
  if (diffHours < 24) return `${diffHours} godz temu`;
  if (diffDays === 1) return '1 dzień temu';
  if (diffDays < 7) return `${diffDays} dni temu`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} tyg temu`;
  return date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
}

function formatSalary(min: number | null, max: number | null, currency: string | null) {
  if (!min && !max) return null;
  const fmt = (n: number) => n.toLocaleString('pl-PL');
  const cur = currency ?? 'PLN';
  if (min && max) return `${fmt(min)} – ${fmt(max)} ${cur}`;
  if (min) return `od ${fmt(min)} ${cur}`;
  return `do ${fmt(max!)} ${cur}`;
}

function workModeLabel(mode: string | null) {
  const labels: Record<string, string> = { remote: 'Zdalnie', office: 'Stacjonarnie', hybrid: 'Hybrydowo' };
  return labels[mode ?? ''] ?? '—';
}

function isGrouped(job: Job | GroupedJob): job is GroupedJob {
  return 'sources' in job && Array.isArray((job as GroupedJob).sources);
}

function getBestSalary(job: GroupedJob): { min: number | null; max: number | null; currency: string | null } {
  let bestMin: number | null = null;
  let bestMax: number | null = null;
  let currency: string | null = null;

  for (const src of job.sources) {
    if (src.salaryMin != null && (bestMin == null || src.salaryMin > bestMin)) bestMin = src.salaryMin;
    if (src.salaryMax != null && (bestMax == null || src.salaryMax > bestMax)) bestMax = src.salaryMax;
    if (src.salaryCurrency) currency = src.salaryCurrency;
  }

  return { min: bestMin, max: bestMax, currency };
}

function getSourceDots(sources: JobSource[]): { source: string; count: number }[] {
  const map = new Map<string, number>();
  for (const s of sources) {
    map.set(s.source, (map.get(s.source) ?? 0) + 1);
  }
  return Array.from(map.entries()).map(([source, count]) => ({ source, count }));
}

function GroupedCard({ job, onFavoritesChange, showSummary, onToggleSummary, preferences, onPreferenceChange }: { job: GroupedJob; onFavoritesChange?: () => void; showSummary: boolean; onToggleSummary: () => void; preferences: PreferenceState; onPreferenceChange: (state: PreferenceState) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const salary = getBestSalary(job);
  const modeClass = WORK_MODE_STYLES[job.workMode ?? ''] ?? 'bg-slate-100 text-slate-600';
  const sourceDots = getSourceDots(job.sources);
  const primarySource = job.sources[0];
  const primaryUrl = primarySource?.sourceUrl ?? '#';

  useEffect(() => {
    setIsFavorite(getFavorites().has(job.id));
  }, [job.id]);

  const handleFavoriteToggle = () => {
    const newFavorites = toggleFavorite(job.id);
    setIsFavorite(newFavorites.has(job.id));
    onFavoritesChange?.();
  };

  return (
    <div className="border border-border rounded-lg bg-card p-4 transition-all duration-200 hover:shadow-lg hover:shadow-accent/5 hover:border-accent/20 hover:scale-[1.005]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <a
            href={primaryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-foreground hover:text-accent hover:underline underline-offset-2 transition-colors block text-sm leading-snug break-words"
          >
            {job.title}
          </a>
          <div className="text-xs text-muted-foreground mt-0.5 break-words">{job.company}</div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={handleFavoriteToggle}
            className={`w-8 h-8 flex items-center justify-center rounded border transition-all duration-150 active:scale-90 ${
              isFavorite
                ? 'border-rose-300 bg-rose-50 text-rose-500'
                : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
            title={isFavorite ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
            </svg>
          </button>
          <button
            onClick={onToggleSummary}
            className={`w-8 h-8 flex items-center justify-center rounded border transition-all duration-150 active:scale-90 ${
              showSummary
                ? 'border-accent/30 bg-accent/10 text-accent'
                : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
            title="Podsumowanie AI"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275-1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z" />
            </svg>
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-8 h-8 flex items-center justify-center rounded border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-150 active:scale-90"
          >
            <svg className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
          <JobCard job={job} preferences={preferences} onPreferenceChange={onPreferenceChange} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-2">
        {salary.min || salary.max ? (
          <span className="font-[family-name:var(--font-mono)] text-accent font-medium text-xs">
            {formatSalary(salary.min, salary.max, salary.currency)}
          </span>
        ) : null}
        {job.city && (
          <span className="text-xs text-muted-foreground">{job.city}</span>
        )}
        <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${modeClass}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          {workModeLabel(job.workMode)}
        </span>
      </div>

      <div className="flex flex-wrap gap-1 mt-2">
        {sourceDots.map(({ source, count }) => (
          <span key={source} className="inline-flex items-center gap-1 text-[11px] font-[family-name:var(--font-mono)] font-medium px-2 py-0.5 rounded-md border border-border bg-card text-muted-foreground">
            <span className={`w-1.5 h-1.5 rounded-full ${SOURCE_MAP[source]?.color ?? 'bg-muted'}`} />
            {SOURCE_MAP[source]?.label ?? source}
            {count > 1 && <span className="text-[10px] text-muted-foreground/60">x{count}</span>}
          </span>
        ))}
      </div>

      {/* AI Summary - shown when clicking sparkle icon */}
      <div className={`transition-all duration-300 ease-in-out ${showSummary ? 'max-h-[2000px] opacity-100 mt-3 pt-3 border-t border-border' : 'max-h-0 opacity-0 overflow-hidden'}`}>
        <AiSummaryCard
          jobTitle={job.title}
          company={job.company}
          description={job.description}
          technologies={job.technologies}
          sourceUrl={primaryUrl}
          onClose={onToggleSummary}
        />
      </div>

      {/* Expanded sources - shown when clicking arrow */}
      <div className={`transition-all duration-300 ease-in-out ${expanded ? 'max-h-[2000px] opacity-100 mt-3 pt-3 border-t border-border' : 'max-h-0 opacity-0 overflow-hidden'}`}>
        <div className="space-y-3">
          {job.technologies.filter(Boolean).length > 0 && (
            <div className="flex flex-wrap gap-1">
              {job.technologies.filter(Boolean).map((tech, i) => (
                <span key={`${tech}-${i}`} className="inline-flex items-center text-[11px] font-[family-name:var(--font-mono)] font-medium px-2 py-0.5 rounded-md bg-muted text-foreground">
                  {tech}
                </span>
              ))}
            </div>
          )}
          {job.sources.map((src) => {
            const srcInfo = SOURCE_MAP[src.source] ?? { label: src.source, color: 'bg-muted' };
            return (
              <div key={src.id} className="flex items-center gap-2 text-xs">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${srcInfo.color}`} />
                <span className="font-[family-name:var(--font-mono)] font-medium text-muted-foreground">{srcInfo.label}</span>
                <a href={src.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-accent hover:underline font-[family-name:var(--font-mono)] break-all truncate">
                  {src.sourceUrl ?? '—'}
                </a>
                <span className="text-muted-foreground font-[family-name:var(--font-mono)] ml-auto flex-shrink-0">
                  {relativeTime(src.publishedAt)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FlatCard({ job, onFavoritesChange, preferences, onPreferenceChange }: { job: Job; onFavoritesChange?: () => void; preferences: PreferenceState; onPreferenceChange: (state: PreferenceState) => void }) {
  const [isFavorite, setIsFavorite] = useState(false);
  const source = SOURCE_MAP[job.source] ?? { label: job.source, color: 'bg-muted' };
  const salary = formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency);
  const modeClass = WORK_MODE_STYLES[job.workMode ?? ''] ?? 'bg-slate-100 text-slate-600';

  useEffect(() => {
    setIsFavorite(getFavorites().has(job.id));
  }, [job.id]);

  const handleFavoriteToggle = () => {
    const newFavorites = toggleFavorite(job.id);
    setIsFavorite(newFavorites.has(job.id));
    onFavoritesChange?.();
  };

  return (
    <div className="border border-border rounded-lg bg-card p-4 transition-all duration-200 hover:shadow-lg hover:shadow-accent/5 hover:border-accent/20 hover:scale-[1.005]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <a
            href={job.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-foreground hover:text-accent hover:underline underline-offset-2 transition-colors block text-sm leading-snug break-words"
          >
            {job.title}
          </a>
          <div className="text-xs text-muted-foreground mt-0.5 break-words">{job.company}</div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={handleFavoriteToggle}
            className={`w-8 h-8 flex items-center justify-center rounded border transition-all duration-150 active:scale-90 flex-shrink-0 ${
              isFavorite
                ? 'border-rose-300 bg-rose-50 text-rose-500'
                : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
            title={isFavorite ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
            </svg>
          </button>
          <JobCard job={job} preferences={preferences} onPreferenceChange={onPreferenceChange} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-2">
        {salary && (
          <span className="font-[family-name:var(--font-mono)] text-accent font-medium text-xs">{salary}</span>
        )}
        {job.city && (
          <span className="text-xs text-muted-foreground">{job.city}</span>
        )}
        <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${modeClass}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          {workModeLabel(job.workMode)}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-2">
        <span className="inline-flex items-center gap-1 text-[11px] font-[family-name:var(--font-mono)] font-medium px-2 py-0.5 rounded-md border border-border bg-card text-muted-foreground">
          <span className={`w-1.5 h-1.5 rounded-full ${source.color}`} />
          {source.label}
        </span>
        {job.technologies.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {job.technologies.slice(0, 3).map((tech) => (
              <span key={tech} className="inline-flex items-center text-[11px] font-[family-name:var(--font-mono)] font-medium px-2 py-0.5 rounded-md bg-muted text-foreground">
                {tech}
              </span>
            ))}
            {job.technologies.length > 3 && (
              <span className="text-[11px] text-muted-foreground">+{job.technologies.length - 3}</span>
            )}
          </div>
        )}
        <span className="text-xs text-muted-foreground font-[family-name:var(--font-mono)] ml-auto">
          {relativeTime(job.publishedAt)}
        </span>
      </div>
    </div>
  );
}

function GroupedRow({ job, onFavoritesChange, showSummary, onToggleSummary, preferences, onPreferenceChange }: { job: GroupedJob; onFavoritesChange?: () => void; showSummary: boolean; onToggleSummary: () => void; preferences: PreferenceState; onPreferenceChange: (state: PreferenceState) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const salary = getBestSalary(job);
  const modeClass = WORK_MODE_STYLES[job.workMode ?? ''] ?? 'bg-slate-100 text-slate-600';
  const sourceDots = getSourceDots(job.sources);
  const primarySource = job.sources[0];
  const primaryUrl = primarySource?.sourceUrl ?? '#';

  useEffect(() => {
    setIsFavorite(getFavorites().has(job.id));
  }, [job.id]);

  const handleFavoriteToggle = () => {
    const newFavorites = toggleFavorite(job.id);
    setIsFavorite(newFavorites.has(job.id));
    onFavoritesChange?.();
  };

  return (
    <>
      <tr className="border-b border-border hover:bg-muted/50 transition-colors group">
        <td className="p-3 min-w-0 max-w-[260px]">
          <div className="flex items-start gap-2">
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <div className="flex items-center gap-1">
                <button
                  onClick={handleFavoriteToggle}
                  className={`w-5 h-5 flex items-center justify-center rounded border transition-all duration-150 active:scale-90 flex-shrink-0 ${
                    isFavorite
                      ? 'border-rose-300 bg-rose-50 text-rose-500'
                      : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                  title={isFavorite ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                  </svg>
                </button>
                <button
                  onClick={onToggleSummary}
                  className={`w-5 h-5 flex items-center justify-center rounded border transition-all duration-150 active:scale-90 flex-shrink-0 ${
                    showSummary
                      ? 'border-accent/30 bg-accent/10 text-accent'
                      : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                  title="Podsumowanie AI"
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275-1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z" />
                  </svg>
                </button>
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="w-5 h-5 flex items-center justify-center rounded border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-150 active:scale-90 flex-shrink-0"
                  aria-label={expanded ? 'Zwiń' : 'Rozwiń'}
                >
                  <svg
                    className={`w-3 h-3 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </button>
              </div>
              <JobCard job={job} preferences={preferences} onPreferenceChange={onPreferenceChange} />
            </div>
            <div className="min-w-0 flex-1">
              <a
                href={primaryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-foreground hover:text-accent hover:underline underline-offset-2 transition-colors block text-sm leading-snug break-words"
              >
                {job.title}
              </a>
              <div className="text-xs text-muted-foreground mt-0.5 break-words" title={job.company}>
                {job.company}
              </div>
            </div>
          </div>
        </td>
        <td className="p-3 text-muted-foreground text-sm">{job.city ?? '—'}</td>
        <td className="p-3">
          {salary.min || salary.max ? (
            <span className="font-[family-name:var(--font-mono)] text-accent font-medium text-xs">
              {formatSalary(salary.min, salary.max, salary.currency)}
            </span>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          )}
        </td>
        <td className="p-3 min-w-0">
          <div className="flex flex-wrap gap-1">
            {[...new Set(job.technologies.filter(Boolean))].slice(0, 2).map((tech, i) => (
              <span key={`${tech}-${i}`} className="inline-flex items-center text-[11px] font-[family-name:var(--font-mono)] font-medium px-2 py-0.5 rounded-md bg-muted text-foreground">
                {tech}
              </span>
            ))}
            {[...new Set(job.technologies.filter(Boolean))].length > 2 && (
              <span className="text-[11px] text-muted-foreground">+{[...new Set(job.technologies.filter(Boolean))].length - 2}</span>
            )}
          </div>
        </td>
        <td className="p-3 hidden xl:table-cell">
          <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${modeClass}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {workModeLabel(job.workMode)}
          </span>
        </td>
        <td className="p-3">
          <div className="flex flex-wrap gap-1">
            {sourceDots.map(({ source, count }) => (
              <span key={source} className="inline-flex items-center gap-1 text-[11px] font-[family-name:var(--font-mono)] font-medium px-2 py-0.5 rounded-md border border-border bg-card text-muted-foreground">
                <span className={`w-1.5 h-1.5 rounded-full ${SOURCE_MAP[source]?.color ?? 'bg-muted'}`} />
                {SOURCE_MAP[source]?.label ?? source}
                {count > 1 && <span className="text-[10px] text-muted-foreground/60">×{count}</span>}
              </span>
            ))}
          </div>
        </td>
        <td className="p-3 text-xs text-muted-foreground font-[family-name:var(--font-mono)] hidden lg:table-cell">
          {relativeTime(job.publishedAt)}
        </td>
      </tr>

      <tr className={`${expanded || showSummary ? '' : 'hidden'}`}>
        <td className="p-3 pl-10" colSpan={8}>
          <div className={`transition-all duration-300 ease-in-out ${expanded || showSummary ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
            {showSummary && (
              <div className="space-y-3 mb-3">
                <AiSummaryCard
                  jobTitle={job.title}
                  company={job.company}
                  description={job.description}
                  technologies={job.technologies}
                  sourceUrl={primaryUrl}
                  onClose={onToggleSummary}
                />
              </div>
            )}
            {expanded && job.sources.map((src) => {
              const srcInfo = SOURCE_MAP[src.source] ?? { label: src.source, color: 'bg-muted' };
              return (
                <div key={src.id} className="flex items-center gap-3 flex-wrap py-2 border-t border-border first:border-t-0">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${srcInfo.color}`} />
                  <span className="text-[11px] font-[family-name:var(--font-mono)] font-medium text-muted-foreground">{srcInfo.label}</span>
                  <a
                    href={src.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-accent hover:underline underline-offset-2 transition-colors font-[family-name:var(--font-mono)] break-all"
                  >
                    {src.sourceUrl ?? '—'}
                  </a>
                </div>
              );
            })}
          </div>
        </td>
      </tr>
    </>
  );
}

function FlatRow({ job, onFavoritesChange, preferences, onPreferenceChange }: { job: Job; onFavoritesChange?: () => void; preferences: PreferenceState; onPreferenceChange: (state: PreferenceState) => void }) {
  const [isFavorite, setIsFavorite] = useState(false);
  const source = SOURCE_MAP[job.source] ?? { label: job.source, color: 'bg-muted' };
  const salary = formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency);
  const modeClass = WORK_MODE_STYLES[job.workMode ?? ''] ?? 'bg-slate-100 text-slate-600';

  useEffect(() => {
    setIsFavorite(getFavorites().has(job.id));
  }, [job.id]);

  const handleFavoriteToggle = () => {
    const newFavorites = toggleFavorite(job.id);
    setIsFavorite(newFavorites.has(job.id));
    onFavoritesChange?.();
  };

  return (
    <tr className="border-b border-border last:border-b-0 hover:bg-muted/50 transition-colors">
      <td className="p-3 min-w-0 max-w-[260px]">
        <div className="flex items-start gap-2">
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            <button
              onClick={handleFavoriteToggle}
              className={`w-5 h-5 flex items-center justify-center rounded border transition-all duration-150 active:scale-90 flex-shrink-0 ${
                isFavorite
                  ? 'border-rose-300 bg-rose-50 text-rose-500'
                  : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
              title={isFavorite ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
              </svg>
            </button>
            <JobCard job={job} preferences={preferences} onPreferenceChange={onPreferenceChange} />
          </div>
          <div className="min-w-0 flex-1">
            <a
              href={job.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-foreground hover:text-accent hover:underline underline-offset-2 transition-colors block break-words"
            >
              {job.title}
            </a>
            <div className="text-xs text-muted-foreground mt-0.5 break-words" title={job.company}>
              {job.company}
            </div>
          </div>
        </div>
      </td>
      <td className="p-3 text-muted-foreground text-sm">{job.city ?? '—'}</td>
      <td className="p-3">
        {salary ? (
          <span className="font-[family-name:var(--font-mono)] text-accent font-medium text-xs">{salary}</span>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </td>
      <td className="p-3 min-w-0">
        <div className="flex flex-wrap gap-1">
          {job.technologies.slice(0, 2).map((tech) => (
            <span key={tech} className="inline-flex items-center text-[11px] font-[family-name:var(--font-mono)] font-medium px-2 py-0.5 rounded-md bg-muted text-foreground">
              {tech}
            </span>
          ))}
          {job.technologies.length > 2 && (
            <span className="text-[11px] text-muted-foreground">+{job.technologies.length - 2}</span>
          )}
        </div>
      </td>
      <td className="p-3 hidden xl:table-cell">
        <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${modeClass}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          {workModeLabel(job.workMode)}
        </span>
      </td>
      <td className="p-3">
        <span className="inline-flex items-center gap-1 text-[11px] font-[family-name:var(--font-mono)] font-medium px-2 py-0.5 rounded-md border border-border bg-card text-muted-foreground">
          <span className={`w-1.5 h-1.5 rounded-full ${source.color}`} />
          {source.label}
        </span>
      </td>
      <td className="p-3 text-xs text-muted-foreground font-[family-name:var(--font-mono)] hidden lg:table-cell">
        {relativeTime(job.publishedAt)}
      </td>
    </tr>
  );
}

export function JobTable({ jobs, total, page, totalPages, onPageChange, onFavoritesChange, preferences, onPreferenceChange }: JobTableProps) {
  const [mounted, setMounted] = useState(false);
  const [expandedSummary, setExpandedSummary] = useState<Record<string, boolean>>({});
  useEffect(() => { setMounted(true); }, []);

  const toggleSummary = useCallback((jobId: string) => {
    setExpandedSummary(prev => ({ ...prev, [jobId]: !prev[jobId] }));
  }, []);

  const getPageNumbers = () => {
    const pages: (number | '...')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('...');
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
        pages.push(i);
      }
      if (page < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  if (!mounted) {
    return (
      <div>
        <div className="border border-border rounded-lg bg-card">
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
          <div className="hidden lg:block overflow-x-auto">
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
                  <th className="p-3 text-left text-[11px] font-[family-name:var(--font-mono)] font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">Ocena</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-border last:border-b-0">
                    <td className="p-3"><div className="h-4 bg-muted rounded animate-pulse w-3/4" /></td>
                    <td className="p-3"><div className="h-4 bg-muted rounded animate-pulse w-20" /></td>
                    <td className="p-3"><div className="h-4 bg-muted rounded animate-pulse w-24" /></td>
                    <td className="p-3"><div className="h-5 bg-muted rounded animate-pulse w-16" /></td>
                    <td className="p-3 hidden xl:table-cell"><div className="h-5 bg-muted rounded-full animate-pulse w-20" /></td>
                    <td className="p-3"><div className="h-5 bg-muted rounded animate-pulse w-20" /></td>
                    <td className="p-3 hidden xl:table-cell"><div className="h-4 bg-muted rounded animate-pulse w-16" /></td>
                    <td className="p-3"><div className="h-8 bg-muted rounded animate-pulse w-16" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="border border-border rounded-lg bg-card">
        {/* Mobile card view */}
        <div className="lg:hidden divide-y divide-border">
          {jobs.map((job) =>
            isGrouped(job) ? (
              <GroupedCard key={job.id} job={job} onFavoritesChange={onFavoritesChange} showSummary={expandedSummary[job.id] ?? false} onToggleSummary={() => toggleSummary(job.id)} preferences={preferences} onPreferenceChange={onPreferenceChange} />
            ) : (
              <FlatCard key={job.id} job={job} onFavoritesChange={onFavoritesChange} preferences={preferences} onPreferenceChange={onPreferenceChange} />
            )
          )}
        </div>

        {/* Desktop table view */}
        <div className="hidden lg:block overflow-x-auto">
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
              {jobs.map((job) =>
                isGrouped(job) ? (
                  <GroupedRow key={job.id} job={job} onFavoritesChange={onFavoritesChange} showSummary={expandedSummary[job.id] ?? false} onToggleSummary={() => toggleSummary(job.id)} preferences={preferences} onPreferenceChange={onPreferenceChange} />
                ) : (
                  <FlatRow key={job.id} job={job} onFavoritesChange={onFavoritesChange} preferences={preferences} onPreferenceChange={onPreferenceChange} />
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 mt-4">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            className="px-2.5 py-1.5 border border-border rounded-md bg-card text-foreground text-xs font-medium hover:bg-muted hover:border-accent/30 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150"
          >
            ←
          </button>
          {getPageNumbers().map((p, i) =>
            p === '...' ? (
              <span key={`dots-${i}`} className="px-1 text-muted-foreground text-xs">…</span>
            ) : (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                className={`min-w-[32px] px-2 py-1.5 border rounded-md text-xs font-medium transition-all duration-150 active:scale-95 ${
                  p === page
                    ? 'bg-accent text-accent-foreground border-accent shadow-md shadow-accent/20'
                    : 'border-border bg-card text-foreground hover:bg-muted hover:border-accent/30'
                }`}
              >
                {p}
              </button>
            )
          )}
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages}
            className="px-2.5 py-1.5 border border-border rounded-md bg-card text-foreground text-xs font-medium hover:bg-muted hover:border-accent/30 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150"
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}
