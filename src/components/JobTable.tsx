'use client';

import { useState, useEffect, useRef } from 'react';
import type { Job, GroupedJob, JobSource } from '@/types/job';

interface JobTableProps {
  jobs: (Job | GroupedJob)[];
  total: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const SOURCE_MAP: Record<string, { label: string; color: string }> = {
  nofluffjobs: { label: 'NoFluffJobs', color: 'bg-accent' },
  justjoin: { label: 'JustJoin', color: 'bg-violet-500' },
  bulldogjob: { label: 'BulldogJob', color: 'bg-blue-500' },
  olx: { label: 'OLX', color: 'bg-orange-500' },
  rocketjobs: { label: 'RocketJobs', color: 'bg-cyan-500' },
  jooble: { label: 'Jooble', color: 'bg-emerald-500' },
  pracuj: { label: 'Pracuj.pl', color: 'bg-rose-500' },
};

const WORK_MODE_STYLES: Record<string, string> = {
  remote: 'bg-emerald-100 text-emerald-700',
  office: 'bg-slate-100 text-slate-600',
  hybrid: 'bg-amber-100 text-amber-700',
};

function parseMarkdown(text: string): string {
  return text
    // Headers ### → <h3>
    .replace(/^### (.+)$/gm, '<h3 class="text-sm font-bold text-foreground mt-3 mb-1.5 flex items-center gap-1.5">$1</h3>')
    // Bold **text** → <strong>
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-foreground font-semibold">$1</strong>')
    // Italic *text* → <em>
    .replace(/\*(.+?)\*/g, '<em class="text-muted-foreground/80">$1</em>')
    // List items * → <li>
    .replace(/^\* (.+)$/gm, '<li class="ml-4 list-disc text-foreground/90 leading-relaxed">$1</li>')
    // Wrap consecutive <li> in <ul>
    .replace(/((?:<li[^>]*>.*?<\/li>\n?)+)/g, '<ul class="my-1.5 space-y-0.5">$1</ul>')
    // Line breaks
    .replace(/\n/g, '<br />');
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

interface AiSummaryProps {
  jobTitle: string;
  company: string;
  description: string | null;
  technologies: string[];
  sourceUrl: string;
}

function AiSummarySection({ jobTitle, company, description, technologies, sourceUrl }: AiSummaryProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [loadStep, setLoadStep] = useState(0);
  const [loadMessage, setLoadMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const fetchSummary = async (force = false) => {
    if ((!force && summary) || summaryLoading) return;
    setSummaryLoading(true);
    setSummaryError(null);
    setLoadStep(0);
    setLoadMessage('');

    try {
      const res = await fetch('/api/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobTitle,
          company,
          description,
          technologies,
          sourceUrl,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        if (errorData.errorType === 'quota_exceeded') {
          setSummaryError(errorData.message || 'Limit API Gemini wyczerpany');
        } else {
          setSummaryError(errorData.error || 'Nie udało się wygenerować podsumowania');
        }
        setSummaryLoading(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No reader');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            const eventType = line.slice(7);
            const dataLine = lines[lines.indexOf(line) + 1];
            if (dataLine?.startsWith('data: ')) {
              const data = JSON.parse(dataLine.slice(6));

              if (eventType === 'progress') {
                setLoadStep(data.step);
                setLoadMessage(data.message);
              } else if (eventType === 'done') {
                setSummary(data.summary);
                setModel(data.model || null);
                setLoadStep(3);
                setLoadMessage('Gotowe!');
              } else if (eventType === 'error') {
                if (data.errorType === 'quota_exceeded') {
                  setSummaryError(data.message || 'Limit API Gemini wyczerpany');
                } else {
                  setSummaryError(data.error || 'Nie udało się wygenerować podsumowania');
                }
              }
            }
          }
        }
      }
    } catch {
      setSummaryError('Błąd połączenia z serwerem');
    } finally {
      setSummaryLoading(false);
      setTimeout(() => {
        setLoadStep(0);
        setLoadMessage('');
      }, 500);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  const handleCopy = async () => {
    if (!summary) return;
    await navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const loadSteps = [
    'Pobieram stronę...',
    'Przygotowuję dane...',
    'Generuję podsumowanie...',
    'Gotowe!',
  ];

  return (
    <div className="bg-gradient-to-br from-accent/5 to-accent/10 border border-accent/20 rounded-lg overflow-hidden transition-all duration-300 hover:shadow-sm hover:border-accent/30">
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z" />
              </svg>
            </div>
            <span className="text-xs font-bold text-foreground uppercase tracking-wider">Podsumowanie AI</span>
          </div>
          <div className="flex items-center gap-1">
            {summary && !summaryLoading && (
              <>
                <button
                  onClick={handleCopy}
                  className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:bg-accent/10 hover:text-accent transition-colors"
                  title="Kopiuj"
                >
                  {copied ? (
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => fetchSummary(true)}
                  className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:bg-accent/10 hover:text-accent transition-colors"
                  title="Odśwież"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    <polyline points="21 3 21 9 15 9" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>

        {summaryLoading && (
          <div className="space-y-2 py-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <svg className="w-3.5 h-3.5 animate-spin text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              <span>{loadMessage || loadSteps[loadStep - 1] || 'Inicjalizuję...'}</span>
            </div>
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                    i <= loadStep ? 'bg-accent' : 'bg-accent/20'
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        {summaryError && (
          <div className="text-xs bg-destructive/10 rounded px-3 py-2 space-y-1">
            <div className="flex items-center gap-2 text-destructive font-medium">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" x2="12" y1="8" y2="12" />
                <line x1="12" x2="12.01" y1="16" y2="16" />
              </svg>
              <span>{summaryError}</span>
            </div>
            {summaryError.includes('wyczerpany') && (
              <p className="text-destructive/70 text-[11px]">
                Limit darmowego tieru: 20 requestów/dzień. Resetuje się codziennie.
              </p>
            )}
          </div>
        )}

        {summary && (
          <div
            ref={contentRef}
            className="text-sm text-foreground/80 leading-relaxed space-y-0"
            dangerouslySetInnerHTML={{ __html: parseMarkdown(summary) }}
          />
        )}
      </div>

      {summary && model && (
        <div className="px-4 py-2 bg-accent/5 border-t border-accent/10">
          <span className="text-[10px] text-muted-foreground/60 font-[family-name:var(--font-mono)]">
            Wygenerowano przez {model}
          </span>
        </div>
      )}
    </div>
  );
}

function GroupedCard({ job }: { job: GroupedJob }) {
  const [expanded, setExpanded] = useState(false);
  const salary = getBestSalary(job);
  const modeClass = WORK_MODE_STYLES[job.workMode ?? ''] ?? 'bg-slate-100 text-slate-600';
  const sourceDots = getSourceDots(job.sources);
  const primarySource = job.sources[0];
  const primaryUrl = primarySource?.sourceUrl ?? '#';

  return (
    <div className="border border-border rounded-lg bg-card p-4 transition-all duration-200 hover:shadow-sm">
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
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-8 h-8 flex items-center justify-center rounded border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors flex-shrink-0"
        >
          <svg className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
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

      <div className={`transition-all duration-300 ease-in-out ${expanded ? 'max-h-[2000px] opacity-100 mt-3 pt-3 border-t border-border' : 'max-h-0 opacity-0 overflow-hidden'}`}>
        <div className="space-y-3">
          <AiSummarySection
            jobTitle={job.title}
            company={job.company}
            description={job.description}
            technologies={job.technologies}
            sourceUrl={primaryUrl}
          />

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

function FlatCard({ job }: { job: Job }) {
  const source = SOURCE_MAP[job.source] ?? { label: job.source, color: 'bg-muted' };
  const salary = formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency);
  const modeClass = WORK_MODE_STYLES[job.workMode ?? ''] ?? 'bg-slate-100 text-slate-600';

  return (
    <div className="border border-border rounded-lg bg-card p-4">
      <div className="min-w-0">
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

function GroupedRow({ job }: { job: GroupedJob }) {
  const [expanded, setExpanded] = useState(false);
  const salary = getBestSalary(job);
  const modeClass = WORK_MODE_STYLES[job.workMode ?? ''] ?? 'bg-slate-100 text-slate-600';
  const sourceDots = getSourceDots(job.sources);
  const primarySource = job.sources[0];
  const primaryUrl = primarySource?.sourceUrl ?? '#';

  return (
    <>
      <tr className="border-b border-border hover:bg-muted/50 transition-colors group">
        <td className="p-3 min-w-0 max-w-[260px]">
          <div className="flex items-start gap-2">
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-0.5 w-5 h-5 flex items-center justify-center rounded border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors flex-shrink-0"
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

      <tr className={`${expanded ? '' : 'hidden'}`}>
        <td className="p-3 pl-10" colSpan={7}>
          <div className={`transition-all duration-300 ease-in-out ${expanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
            <div className="space-y-3 mb-3">
              <AiSummarySection
                jobTitle={job.title}
                company={job.company}
                description={job.description}
                technologies={job.technologies}
                sourceUrl={primaryUrl}
              />
            </div>
          </div>
        </td>
      </tr>

      {expanded && job.sources.map((src) => {
        const srcInfo = SOURCE_MAP[src.source] ?? { label: src.source, color: 'bg-muted' };
        return (
          <tr key={src.id} className="border-b border-border last:border-b-0 bg-muted/30 hover:bg-muted/60 transition-colors">
            <td className="p-3 pl-10" colSpan={7}>
              <div className="flex items-center gap-3 flex-wrap">
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
                <span className="text-[11px] text-muted-foreground font-[family-name:var(--font-mono)]">
                  {relativeTime(src.publishedAt)}
                </span>
              </div>
            </td>
          </tr>
        );
      })}
    </>
  );
}

function FlatRow({ job }: { job: Job }) {
  const source = SOURCE_MAP[job.source] ?? { label: job.source, color: 'bg-muted' };
  const salary = formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency);
  const modeClass = WORK_MODE_STYLES[job.workMode ?? ''] ?? 'bg-slate-100 text-slate-600';

  return (
    <tr className="border-b border-border last:border-b-0 hover:bg-muted/50 transition-colors">
      <td className="p-3 min-w-0 max-w-[260px]">
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

export function JobTable({ jobs, total, page, totalPages, onPageChange }: JobTableProps) {
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

  return (
    <div>
      <div className="border border-border rounded-lg bg-card">
        {/* Mobile card view */}
        <div className="lg:hidden divide-y divide-border">
          {jobs.map((job) =>
            isGrouped(job) ? (
              <GroupedCard key={job.id} job={job} />
            ) : (
              <FlatCard key={job.id} job={job} />
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
                  <GroupedRow key={job.id} job={job} />
                ) : (
                  <FlatRow key={job.id} job={job} />
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
            className="px-2.5 py-1.5 border border-border rounded-md bg-card text-foreground text-xs font-medium hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
                className={`min-w-[32px] px-2 py-1.5 border rounded-md text-xs font-medium transition-colors ${
                  p === page
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border bg-card text-foreground hover:bg-muted'
                }`}
              >
                {p}
              </button>
            )
          )}
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages}
            className="px-2.5 py-1.5 border border-border rounded-md bg-card text-foreground text-xs font-medium hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}
