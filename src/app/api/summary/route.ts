import { NextRequest, NextResponse } from 'next/server';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const allModels = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
];

const workingModels: string[] = [];

interface GenerateResult {
  text: string | null;
  quotaExceeded: boolean;
  retryAfter: number | null;
}

async function tryGenerateContent(modelName: string, prompt: string): Promise<GenerateResult> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    const data = await response.json();

    if (response.status === 429) {
      const retryAfter = data.error?.details?.find(
        (d: { retryInfo?: { retryDelay?: string } }) => d.retryInfo?.retryDelay
      )?.retryInfo?.retryDelay;
      return {
        text: null,
        quotaExceeded: true,
        retryAfter: retryAfter ? parseInt(retryAfter) : null,
      };
    }

    if (!response.ok) {
      return { text: null, quotaExceeded: false, retryAfter: null };
    }

    return {
      text: data.candidates?.[0]?.content?.parts?.[0]?.text ?? null,
      quotaExceeded: false,
      retryAfter: null,
    };
  } catch {
    return { text: null, quotaExceeded: false, retryAfter: null };
  }
}

async function scrapeJobPage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return null;

    const html = await response.text();
    return extractTextFromHtml(html);
  } catch {
    return null;
  }
}

function extractTextFromHtml(html: string): string {
  let text = html;

  // Remove scripts, styles, nav, header, footer
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '');
  text = text.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');
  text = text.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');

  // Try to find main content area
  const mainMatch = text.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  const articleMatch = text.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  const contentMatch = text.match(/<div[^>]*class="[^"]*(?:content|description|details|offer)[^"]*"[^>]*>([\s\S]*?)<\/div>/i);

  if (mainMatch) text = mainMatch[1];
  else if (articleMatch) text = articleMatch[1];
  else if (contentMatch) text = contentMatch[1];

  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, ' ');

  // Clean up whitespace
  text = text.replace(/\s+/g, ' ').trim();

  // Decode HTML entities
  text = text.replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

  // Limit to ~3000 chars for Gemini context
  return text.substring(0, 3000);
}

function buildPrompt(
  jobTitle: string,
  company: string,
  technologies: string[],
  scrapedContent: string | null,
  existingDescription: string | null,
): string {
  const content = scrapedContent || existingDescription || 'Brak szczegółowego opisu';

  return `Przeanalizuj poniższą ofertę pracy i wyciągnij najważniejsze informacje, których NIE WIDAĆ gołym okiem w podstawowych danych.

Odpowiedz TYLKO w poniższym formacie Markdown:

### 🎯 Co będziesz robić?
[2-3 zdania o faktycznych obowiązkach - nie tytuły stanowisk, tylko konkretne zadania]

### 💎 Co firma oferuje oprócz pensji?
[Benefity, szkolenia, atmosfera, ciekawe projekty - tylko to co jest w treści]

### ⚠️ Na co zwrócić uwagę?
[Czerwone flagi: brak widełek, overload wymagań, niejasne warunki, lub pozytywne zaskoczenia]

### 👥 Zespół i praca
[Rozmiar zespołu, z kim współpracujesz, tryb pracy, godziny - jeśli wiadomo]

### 🔮 Perspektywy
[Rozwój, ścieżka kariery, możliwość nauki - jeśli wynika z oferty]

Zasady:
- Pisz konkretnie, unikaj ogólników
- Jeśli czegoś nie ma w treści, NIE wymyślaj - po prostu pomiń tę sekcję
- Nie powtarzaj danych z tabeli (tytuł, firma, miasto, technologie)

Oferta:
${jobTitle} w ${company}
Technologie: ${technologies.join(', ')}

Treść strony:
${content}`;
}

export async function POST(request: NextRequest) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json({ error: 'Brak klucza API Gemini' }, { status: 500 });
  }

  const { jobTitle, company, description, technologies, sourceUrl } = await request.json();

  // Scrape job page for full content
  let scrapedContent = null;
  if (sourceUrl) {
    scrapedContent = await scrapeJobPage(sourceUrl);
  }

  const prompt = buildPrompt(
    jobTitle,
    company,
    technologies ?? [],
    scrapedContent,
    description,
  );

  const tryOrder = [...new Set([...workingModels, ...allModels])];
  let lastQuotaExceeded = false;
  let lastRetryAfter = null;

  for (const modelName of tryOrder) {
    const result = await tryGenerateContent(modelName, prompt);

    if (result.text) {
      if (!workingModels.includes(modelName)) {
        workingModels.push(modelName);
      }
      return NextResponse.json({
        summary: result.text,
        model: modelName,
        scraped: scrapedContent !== null,
      });
    }

    if (result.quotaExceeded) {
      lastQuotaExceeded = true;
      lastRetryAfter = result.retryAfter;
    }
  }

  if (lastQuotaExceeded) {
    return NextResponse.json({
      error: 'Limit API Gemini wyczerpany',
      errorType: 'quota_exceeded',
      retryAfter: lastRetryAfter,
      message: `Przekroczono dzienny limit darmowego tieru (20 requestów/dzień). Spróbuj ponownie jutro lub upgrade do płatnego tieru.`,
    }, { status: 429 });
  }

  return NextResponse.json({ error: 'Nie udało się wygenerować podsumowania' }, { status: 500 });
}
