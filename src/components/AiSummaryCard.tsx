'use client';

import { useState, useRef } from 'react';
import DOMPurify from 'dompurify';
import './AiSummaryCard.css';

interface AiSummaryCardProps {
  jobTitle: string;
  company: string;
  description: string | null;
  technologies: string[];
  sourceUrl: string;
}

interface SummarySection {
  icon: 'blue' | 'green' | 'purple' | 'orange' | 'teal';
  title: string;
  body: string;
}

function SectionIcon({ type }: { type: SummarySection['icon'] }) {
  switch (type) {
    case 'blue':
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>;
    case 'green':
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;
    case 'orange':
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>;
    case 'purple':
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
    case 'teal':
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>;
  }
}

const SECTION_CONFIG: Record<string, SummarySection['icon']> = {
  'Co będziesz robić': 'blue',
  'Co firma oferuje': 'green',
  'Na co zwrócić uwagę': 'orange',
  'Zespół i praca': 'purple',
  'Perspektywy': 'teal',
};

function parseMarkdownToSections(markdown: string): SummarySection[] {
  const sections: SummarySection[] = [];
  const parts = markdown.split(/^### /m).filter(Boolean);

  for (const part of parts) {
    const lines = part.trim().split('\n');
    const titleLine = lines[0]
      .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .replace(/[?!.,:;]/g, '')
      .trim();
    const body = lines.slice(1).join('\n').trim();

    const iconType = Object.entries(SECTION_CONFIG).find(([key]) =>
      titleLine.includes(key)
    )?.[1];

    sections.push({
      icon: iconType ?? 'blue',
      title: titleLine,
      body: parseInlineMarkdown(body),
    });
  }

  return sections;
}

function parseInlineMarkdown(text: string): string {
  const result = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>');

  const lines = result.split('\n');
  const processed: string[] = [];
  let inList = false;

  for (const line of lines) {
    if (line.startsWith('<li>')) {
      if (!inList) {
        processed.push('<ul>');
        inList = true;
      }
      processed.push(line);
    } else {
      if (inList) {
        processed.push('</ul>');
        inList = false;
      }
      processed.push(line);
    }
  }
  if (inList) processed.push('</ul>');

  return '<p>' + processed.join('\n').replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br/>') + '</p>';
}

export function AiSummaryCard({ jobTitle, company, description, technologies, sourceUrl }: AiSummaryCardProps) {
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState('');
  const [loadStep, setLoadStep] = useState(0);
  const [loadMessage, setLoadMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const fetchSummary = async () => {
    setLoading(true);
    setError(null);
    setSummary('');
    setLoadStep(1);

    try {
      const response = await fetch('/api/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobTitle, company, description, technologies, sourceUrl }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.errorType === 'quota_exceeded') {
          setError(errorData.message || 'Limit API Gemini wyczerpany');
        } else {
          setError(errorData.error || 'Nie udało się wygenerować podsumowania');
        }
        setLoading(false);
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (let i = 0; i < lines.length; i++) {
          if (lines[i].startsWith('event: ')) {
            const eventType = lines[i].slice(7).trim();
            const dataLine = lines[i + 1];
            if (dataLine?.startsWith('data: ')) {
              const data = JSON.parse(dataLine.slice(6));

              if (eventType === 'progress') {
                setLoadStep(data.step);
                setLoadMessage(data.message);
              } else if (eventType === 'done') {
                setSummary(data.summary);
                setModel(data.model);
                setLoadStep(3);
                setLoadMessage('Gotowe!');
              } else if (eventType === 'error') {
                if (data.errorType === 'quota_exceeded') {
                  setError(data.message || 'Limit API Gemini wyczerpany');
                } else {
                  setError(data.error || 'Nie udało się wygenerować podsumowania');
                }
              }
            }
          }
        }
      }
    } catch {
      setError('Błąd połączenia z serwerem');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!summary) return;
    await navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sections = summary ? parseMarkdownToSections(summary) : [];

  return (
    <div className="ai-summary-container">
      {summary && (
        <div className="ai-header">
          <div className="ai-header-left">
            <svg className="w-5 h-5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z" />
            </svg>
            <div className="ai-title">Podsumowanie AI</div>
          </div>
          <div className="ai-actions">
            <button className="w-8 h-8 flex items-center justify-center rounded border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" onClick={fetchSummary} title="Odśwież">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10"/>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
            </button>
            <button className="w-8 h-8 flex items-center justify-center rounded border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" onClick={handleCopy} title={copied ? 'Skopiowano!' : 'Kopiuj'}>
              {copied ? (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5"/>
                </svg>
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                </svg>
              )}
            </button>
          </div>
        </div>
      )}

      <div className="ai-card">
        {!summary && !loading && !error && (
          <div className="p-4">
            <button
              onClick={fetchSummary}
              className="w-full flex items-center justify-center gap-2 text-xs text-accent hover:text-accent/80 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z" />
              </svg>
              <span>Wygeneruj podsumowanie AI</span>
            </button>
          </div>
        )}
        {loading && (
          <div className="ai-loading">
            <div className="ai-loading-header">
              <div className="ai-loading-spinner" />
              <div className="ai-loading-text">{loadMessage || 'Pracuję...'}</div>
            </div>
            <div className="ai-loading-step">Krok {loadStep}/3</div>
            <div className="ai-progress-bar">
              <div className="ai-progress-fill" style={{ width: `${(loadStep / 3) * 100}%` }} />
            </div>
          </div>
        )}

        {error && (
          <div className="ai-error">
            <div className="ai-error-box">{error}</div>
          </div>
        )}

        {sections.map((section, i) => (
          <div key={i} className="ai-section">
            <div className="ai-section-header">
              <div className={`ai-section-icon ${section.icon}`}>
                <SectionIcon type={section.icon} />
              </div>
              <div className="ai-section-title">{section.title}</div>
            </div>
            <div className="ai-section-body" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(section.body) }} />
          </div>
        ))}

        {summary && (
          <div className="ai-footer">
            <div className="ai-footer-left">
              <div className="ai-dot" />
              <span>Wygenerowano przez AI • {model}</span>
            </div>
            {copied && <span className="ai-copied-msg">Skopiowano!</span>}
          </div>
        )}
      </div>
    </div>
  );
}
