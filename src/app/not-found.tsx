import Link from 'next/link';

const wobbleKeyframes = `@keyframes wobble { 0%,100%{transform:rotate(-5deg)} 50%{transform:rotate(5deg)} }`;

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <style>{wobbleKeyframes}</style>
      <div className="text-center max-w-md">
        <div className="relative w-24 h-24 mx-auto mb-6">
          <div className="absolute inset-0 rounded-full bg-accent/10 animate-pulse" />
          <div className="relative w-full h-full rounded-full bg-muted flex items-center justify-center">
            <svg className="w-12 h-12 text-muted-foreground" style={{ animation: 'wobble 2s ease-in-out infinite' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="m15 9-6 6" />
              <path d="m9 9 6 6" />
            </svg>
          </div>
        </div>
        <h1 className="text-5xl font-bold tracking-tighter mb-3 bg-gradient-to-b from-foreground to-muted-foreground bg-clip-text text-transparent">404</h1>
        <p className="text-lg text-muted-foreground mb-2">
          Nie znaleziono strony
        </p>
        <p className="text-sm text-muted-foreground mb-8 max-w-xs mx-auto">
          Strona, której szukasz, nie istnieje lub została przeniesiona.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 active:scale-95 transition-all duration-150 shadow-md shadow-accent/20"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m12 19-7-7 7-7" />
            <path d="M19 12H5" />
          </svg>
          Wróć do strony głównej
        </Link>
      </div>
    </div>
  );
}
