import { NextRequest } from 'next/server';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const allModels = [
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
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

  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '');
  text = text.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');
  text = text.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');

  const mainMatch = text.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  const articleMatch = text.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  const contentMatch = text.match(/<div[^>]*class="[^"]*(?:content|description|details|offer)[^"]*"[^>]*>([\s\S]*?)<\/div>/i);

  if (mainMatch) text = mainMatch[1];
  else if (articleMatch) text = articleMatch[1];
  else if (contentMatch) text = contentMatch[1];

  text = text.replace(/<[^>]+>/g, ' ');
  text = text.replace(/\s+/g, ' ').trim();

  text = text.replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

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
    return new Response(JSON.stringify({ error: 'Brak klucza API Gemini' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { jobTitle, company, description, technologies, sourceUrl } = await request.json();

  const ALLOWED_DOMAINS = [
    'pracuj.pl', 'it.pracuj.pl', 'www.pracuj.pl',
    'justjoin.it', 'www.justjoin.it',
    'nofluffjobs.com', 'www.nofluffjobs.com',
    'olx.pl', 'www.olx.pl',
    'bulldogjob.com', 'www.bulldogjob.com',
    'rocketjobs.pl', 'www.rocketjobs.pl',
    'linkedin.com', 'www.linkedin.com',
  ];

  if (sourceUrl) {
    try {
      const url = new URL(sourceUrl);
      if (url.protocol !== 'https:') {
        return new Response(JSON.stringify({ error: 'Dozwolone tylko HTTPS' }), { status: 400 });
      }
      if (!ALLOWED_DOMAINS.includes(url.hostname)) {
        return new Response(JSON.stringify({ error: 'Niedozwolona domena' }), { status: 403 });
      }
    } catch {
      return new Response(JSON.stringify({ error: 'Nieprawidłowy URL' }), { status: 400 });
    }
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // Step 1: Scraping
        send('progress', { step: 1, message: 'Pobieram stronę oferty...' });

        let scrapedContent = null;
        if (sourceUrl) {
          scrapedContent = await scrapeJobPage(sourceUrl);
        }

        send('progress', { step: 1, done: true, message: scrapedContent ? 'Strona pobrana' : 'Brak treści na stronie' });

        // Step 2: Building prompt
        send('progress', { step: 2, message: 'Przygotowuję dane do analizy...' });

        const prompt = buildPrompt(
          jobTitle,
          company,
          technologies ?? [],
          scrapedContent,
          description,
        );

        send('progress', { step: 2, done: true, message: 'Dane przygotowane' });

        // Step 3: AI generating
        send('progress', { step: 3, message: 'Generuję podsumowanie przez AI...' });

        const tryOrder = [...new Set([...workingModels, ...allModels])];
        let lastQuotaExceeded = false;
        let lastRetryAfter = null;

        for (const modelName of tryOrder) {
          send('progress', { step: 3, message: `Próbuję model: ${modelName}...` });

          const result = await tryGenerateContent(modelName, prompt);

          if (result.text) {
            if (!workingModels.includes(modelName)) {
              workingModels.push(modelName);
            }
            send('done', {
              summary: result.text,
              model: modelName,
              scraped: scrapedContent !== null,
            });
            controller.close();
            return;
          }

          if (result.quotaExceeded) {
            lastQuotaExceeded = true;
            lastRetryAfter = result.retryAfter;
          }
        }

        if (lastQuotaExceeded) {
          send('error', {
            error: 'Limit API Gemini wyczerpany',
            errorType: 'quota_exceeded',
            retryAfter: lastRetryAfter,
            message: 'Przekroczono dzienny limit darmowego tieru (20 requestów/dzień). Spróbuj ponownie jutro.',
          });
        } else {
          send('error', {
            error: 'Nie udało się wygenerować podsumowania',
          });
        }
      } catch {
        send('error', { error: 'Błąd połączenia z serwerem' });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
