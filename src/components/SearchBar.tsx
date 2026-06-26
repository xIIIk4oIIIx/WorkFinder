'use client';

import { useState } from 'react';

interface SearchBarProps {
  onSearch: (query: string) => void;
}

export function SearchBar({ onSearch }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query);
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <div className="relative flex-1">
        <div
          className="absolute left-3 top-0 bottom-0 flex items-center pointer-events-none"
          style={{
            transform: isFocused ? 'scale(1.1)' : 'scale(1)',
            transition: 'transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          <svg
            className="text-muted-foreground w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Szukaj po tytule, firmie, technologii..."
          className="w-full pl-10 pr-10 py-2.5 border border-border rounded-lg bg-card text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all duration-200"
          style={{
            boxShadow: isFocused
              ? '0 0 0 3px oklch(0.65 0.14 155 / 0.15)'
              : '0 0 0 0 oklch(0.65 0.14 155 / 0)',
            transition: 'box-shadow 200ms ease, border-color 200ms ease, ring 200ms ease',
          }}
        />
        <button
          type="button"
          onClick={() => setQuery('')}
          className="absolute right-3 top-1 bottom-1 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all duration-150"
          style={{
            opacity: query ? 1 : 0,
            transform: query ? 'scale(1)' : 'scale(0.8)',
            pointerEvents: query ? 'auto' : 'none',
          }}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>
      <button type="submit" className="px-4 py-2.5 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 active:scale-95 transition-all duration-150 shadow-md shadow-accent/20">
        Szukaj
      </button>
    </form>
  );
}
