# AI Summary Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the inline AiSummarySection in JobTable with a standalone AiSummaryCard component featuring an Apple-inspired design system with structured sections, score bar, and responsive layout.

**Architecture:** Extract AiSummarySection from JobTable.tsx into a standalone component. Create CSS file with custom properties matching the spec. Parse markdown response from existing /api/summary into structured sections with colored icons. Keep SSE streaming intact.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, custom CSS variables, SSE streaming

## Global Constraints

- Use existing Tailwind v4 CSS variable system (oklch colors in globals.css)
- Keep existing `/api/summary` SSE endpoint unchanged
- Component must work in both light and dark themes
- Mobile-first responsive design (breakpoint at 640px)
- All icons use stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `src/components/AiSummaryCard.css` | Create | CSS custom properties + component styles |
| `src/components/AiSummaryCard.tsx` | Create | Standalone summary card component |
| `src/components/JobTable.tsx` | Modify | Replace AiSummarySection with AiSummaryCard import |
| `src/app/globals.css` | Modify | Import AiSummaryCard.css |

---

### Task 1: Create CSS Design System

**Covers:** [S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12]

**Files:**
- Create: `src/components/AiSummaryCard.css`

**Interfaces:**
- Consumes: CSS variables from globals.css (--bg, --surface, --fg, --muted, --border, --accent)
- Produces: CSS classes for AiSummaryCard component

- [ ] **Step 1: Create CSS file with custom properties and all styles**

Create `src/components/AiSummaryCard.css` with the complete design system from the spec:

```css
/* AI Summary Card Design System */
.ai-summary-container {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  max-width: 720px;
}

/* Header */
.ai-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 28px;
  padding: 0 4px;
}

.ai-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ai-badge {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--accent), #5e5ce6);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.ai-badge svg { width: 20px; height: 20px; }

.ai-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--foreground);
  letter-spacing: 0.02em;
}

.ai-subtitle {
  font-size: 12px;
  color: var(--muted-foreground);
}

/* Action buttons */
.ai-actions { display: flex; gap: 6px; }

.ai-action-btn {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--card);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--muted-foreground);
  transition: all 0.15s ease;
}

.ai-action-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-dim);
}

.ai-action-btn svg { width: 16px; height: 16px; }

/* Card */
.ai-card {
  background: var(--card);
  border-radius: 16px;
  border: 1px solid var(--border);
  overflow: hidden;
}

/* Sections */
.ai-section {
  padding: 24px 28px;
  position: relative;
}

.ai-section + .ai-section {
  border-top: 1px solid var(--border);
}

.ai-section-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.ai-section-icon {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.ai-section-icon svg { width: 16px; height: 16px; }

.ai-section-icon.green  { background: rgba(48, 209, 88, 0.08);  color: #30d158; }
.ai-section-icon.blue   { background: rgba(41, 151, 255, 0.08); color: var(--accent); }
.ai-section-icon.orange { background: rgba(255, 159, 10, 0.08); color: #ff9f0a; }
.ai-section-icon.purple { background: rgba(191, 90, 242, 0.08); color: #bf5af2; }
.ai-section-icon.teal   { background: rgba(100, 210, 255, 0.08); color: #64d2ff; }

.ai-section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--foreground);
  letter-spacing: 0.01em;
}

.ai-section-body {
  padding-left: 38px;
  font-size: 14px;
  color: var(--muted-foreground);
  line-height: 1.65;
}

.ai-section-body strong {
  color: var(--foreground);
  font-weight: 500;
}

/* Tags */
.ai-tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.ai-tag {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  background: var(--background);
  color: var(--muted-foreground);
  border: 1px solid var(--border);
}

.ai-tag.match   { background: rgba(48, 209, 88, 0.08);  color: #30d158;  border-color: transparent; }
.ai-tag.partial { background: rgba(255, 159, 10, 0.08); color: #ff9f0a; border-color: transparent; }

/* Score bar */
.ai-score-bar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ai-score-track {
  flex: 1;
  height: 6px;
  background: var(--background);
  border-radius: 3px;
  overflow: hidden;
}

.ai-score-fill {
  height: 100%;
  border-radius: 3px;
  background: linear-gradient(90deg, var(--accent), #30d158);
  transition: width 0.8s ease;
}

.ai-score-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--foreground);
  min-width: 48px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.ai-score-label {
  font-size: 12px;
  color: var(--muted-foreground);
}

/* Match summary */
.ai-match-summary {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12px;
  margin-top: 16px;
}

.ai-match-stat {
  text-align: center;
  padding: 12px 8px;
  background: var(--background);
  border-radius: 10px;
}

.ai-match-stat-value {
  font-size: 20px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.ai-match-stat-value.green  { color: #30d158; }
.ai-match-stat-value.orange { color: #ff9f0a; }
.ai-match-stat-value.muted  { color: var(--muted-foreground); }

.ai-match-stat-label {
  font-size: 11px;
  color: var(--muted-foreground);
  margin-top: 2px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

/* Footer */
.ai-footer {
  padding: 16px 28px;
  border-top: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: var(--muted-foreground);
}

.ai-footer-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.ai-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #30d158;
}

/* Loading state */
.ai-loading {
  padding: 24px 28px;
}

.ai-loading-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.ai-loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: ai-spin 0.8s linear infinite;
}

@keyframes ai-spin {
  to { transform: rotate(360deg); }
}

.ai-loading-text {
  font-size: 13px;
  color: var(--muted-foreground);
}

.ai-loading-step {
  font-size: 11px;
  color: var(--muted-foreground);
  margin-top: 8px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.ai-progress-bar {
  height: 3px;
  background: var(--background);
  border-radius: 2px;
  overflow: hidden;
  margin-top: 12px;
}

.ai-progress-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 2px;
  transition: width 0.3s ease;
}

/* Error state */
.ai-error {
  padding: 16px 28px;
}

.ai-error-box {
  background: rgba(255, 69, 58, 0.08);
  border-radius: 8px;
  padding: 12px 16px;
  font-size: 13px;
  color: #ff453a;
}

/* Responsive */
@media (max-width: 640px) {
  .ai-section { padding: 20px 16px; }
  .ai-section-body { padding-left: 0; margin-top: 8px; }
  .ai-match-summary { grid-template-columns: 1fr; }
  .ai-footer {
    padding: 14px 16px;
    flex-direction: column;
    gap: 8px;
  }
}
```

- [ ] **Step 2: Commit CSS file**

```bash
git add src/components/AiSummaryCard.css
git commit -m "feat: add AI Summary Card CSS design system"
```

---

### Task 2: Create AiSummaryCard Component

**Covers:** [S13, S14, S15, S16]

**Files:**
- Create: `src/components/AiSummaryCard.tsx`

**Interfaces:**
- Consumes: CSS classes from AiSummaryCard.css, SSE from /api/summary
- Produces: `<AiSummaryCard>` React component

- [ ] **Step 1: Create the component with markdown parser and SSE streaming**

Create `src/components/AiSummaryCard.tsx`:

```tsx
'use client';

import { useState, useRef, useEffect } from 'react';
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

const SECTION_CONFIG: Record<string, { icon: SummarySection['icon']; svg: string }> = {
  'Co będziesz robić': { icon: 'blue', svg: '<rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>' },
  'Co firma oferuje': { icon: 'green', svg: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>' },
  'Na co zwrócić uwagę': { icon: 'orange', svg: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12" y1="17" y2="17"/>' },
  'Zespół i praca': { icon: 'purple', svg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>' },
  'Perspektywy': { icon: 'teal', svg: '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>' },
};

function parseMarkdownToSections(markdown: string): SummarySection[] {
  const sections: SummarySection[] = [];
  const parts = markdown.split(/^### /m).filter(Boolean);

  for (const part of parts) {
    const lines = part.trim().split('\n');
    const titleLine = lines[0].replace(/^[🎯💎⚠️👥🔮]\s*/, '').trim();
    const body = lines.slice(1).join('\n').trim();

    const config = Object.entries(SECTION_CONFIG).find(([key]) =>
      titleLine.includes(key)
    );

    sections.push({
      icon: config?.[1]?.icon ?? 'blue',
      title: titleLine,
      body: parseInlineMarkdown(body),
    });
  }

  return sections;
}

function parseInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/gs, (match) => `<ul>${match}</ul>`)
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>')
    .replace(/^/, '<p>')
    .replace(/$/, '</p>');
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

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            const eventType = line.slice(7).trim();
            if (eventType === 'done') {
              const dataLine = lines.find(l => l.startsWith('data: '));
              if (dataLine) {
                const data = JSON.parse(dataLine.slice(6));
                setSummary(data.summary);
                setModel(data.model);
                setLoading(false);
              }
            } else if (eventType === 'error') {
              const dataLine = lines.find(l => l.startsWith('data: '));
              if (dataLine) {
                const data = JSON.parse(dataLine.slice(6));
                setError(data.message || data.error);
                setLoading(false);
              }
            } else if (eventType === 'progress') {
              const dataLine = lines.find(l => l.startsWith('data: '));
              if (dataLine) {
                const data = JSON.parse(dataLine.slice(6));
                setLoadStep(data.step);
                setLoadMessage(data.message);
              }
            }
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd połączenia');
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
      <div className="ai-header">
        <div className="ai-header-left">
          <div className="ai-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <div>
            <div className="ai-title">Podsumowanie AI</div>
            <div className="ai-subtitle">Analiza oferty pracy</div>
          </div>
        </div>
        <div className="ai-actions">
          {!summary && !loading && (
            <button className="ai-action-btn" onClick={fetchSummary} title="Wygeneruj">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10"/>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
            </button>
          )}
          {summary && (
            <button className="ai-action-btn" onClick={fetchSummary} title="Odśwież">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10"/>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
            </button>
          )}
          {summary && (
            <button className="ai-action-btn" onClick={handleCopy} title="Kopiuj">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="ai-card">
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
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: SECTION_CONFIG[section.title]?.svg ?? '' }} />
              </div>
              <div className="ai-section-title">{section.title}</div>
            </div>
            <div className="ai-section-body" dangerouslySetInnerHTML={{ __html: section.body }} />
          </div>
        ))}

        {summary && (
          <div className="ai-footer">
            <div className="ai-footer-left">
              <div className="ai-dot" />
              <span>Wygenerowano przez AI • {model}</span>
            </div>
            <span>{copied ? 'Skopiowano!' : ''}</span>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit component**

```bash
git add src/components/AiSummaryCard.tsx
git commit -m "feat: add AiSummaryCard component with markdown parser"
```

---

### Task 3: Integrate with JobTable

**Covers:** Integration with existing UI

**Files:**
- Modify: `src/components/JobTable.tsx`

**Interfaces:**
- Consumes: `<AiSummaryCard>` from Task 2
- Produces: Updated JobTable using new component

- [ ] **Step 1: Replace AiSummarySection with AiSummaryCard in JobTable**

In `src/components/JobTable.tsx`:
1. Add import: `import { AiSummaryCard } from './AiSummaryCard';`
2. Remove the entire `AiSummarySection` function (lines ~127-359)
3. Remove the `parseMarkdown` function (lines ~53-67)
4. Replace all `<AiSummarySection ... />` usages with `<AiSummaryCard ... />`
5. Remove `import './AiSummaryCard.css'` from JobTable if it was there (it shouldn't be)

The replacement is direct — same props interface.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit integration**

```bash
git add src/components/JobTable.tsx
git commit -m "refactor: replace inline AiSummarySection with AiSummaryCard"
```

---

### Task 4: Verify and Test

**Files:**
- No new files

- [ ] **Step 1: Run dev server and test visually**

```bash
npm run dev
```

Open http://localhost:3000, expand a grouped job, click the AI summary button, verify:
- Header with badge, title, subtitle renders correctly
- Loading spinner with 3-step progress works
- Markdown sections parse into colored icon sections
- Score bar renders (if applicable)
- Footer shows model name
- Copy button works
- Mobile responsive at 640px breakpoint

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete AI Summary Card implementation"
git push origin master
```
