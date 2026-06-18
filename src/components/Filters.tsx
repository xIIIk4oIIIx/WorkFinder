'use client';

import { useState } from 'react';

interface FiltersProps {
  onFilter: (filters: FilterState) => void;
}

export interface FilterState {
  city: string;
  technology: string;
  workMode: string;
  salaryMin: string;
  salaryMax: string;
  company: string;
  publishedAfter: string;
}

export function Filters({ onFilter }: FiltersProps) {
  const [filters, setFilters] = useState<FilterState>({
    city: '',
    technology: '',
    workMode: '',
    salaryMin: '',
    salaryMax: '',
    company: '',
    publishedAfter: '',
  });

  const handleChange = (key: keyof FilterState, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilter(newFilters);
  };

  return (
    <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
      <h3 className="font-semibold text-lg">Filtry</h3>

      <div>
        <label className="block text-sm font-medium mb-1">Miasto</label>
        <input
          type="text"
          value={filters.city}
          onChange={(e) => handleChange('city', e.target.value)}
          placeholder="np. Warszawa"
          className="w-full px-3 py-2 border rounded"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Technologia</label>
        <input
          type="text"
          value={filters.technology}
          onChange={(e) => handleChange('technology', e.target.value)}
          placeholder="np. React"
          className="w-full px-3 py-2 border rounded"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Tryb pracy</label>
        <select
          value={filters.workMode}
          onChange={(e) => handleChange('workMode', e.target.value)}
          className="w-full px-3 py-2 border rounded"
        >
          <option value="">Wszystkie</option>
          <option value="remote">Zdalnie</option>
          <option value="office">Stacjonarnie</option>
          <option value="hybrid">Hybrydowo</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Zarobki (min-max)</label>
        <div className="flex gap-2">
          <input
            type="number"
            value={filters.salaryMin}
            onChange={(e) => handleChange('salaryMin', e.target.value)}
            placeholder="Min"
            className="w-1/2 px-3 py-2 border rounded"
          />
          <input
            type="number"
            value={filters.salaryMax}
            onChange={(e) => handleChange('salaryMax', e.target.value)}
            placeholder="Max"
            className="w-1/2 px-3 py-2 border rounded"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Firma</label>
        <input
          type="text"
          value={filters.company}
          onChange={(e) => handleChange('company', e.target.value)}
          placeholder="np. mBank"
          className="w-full px-3 py-2 border rounded"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Data publikacji</label>
        <select
          value={filters.publishedAfter}
          onChange={(e) => handleChange('publishedAfter', e.target.value)}
          className="w-full px-3 py-2 border rounded"
        >
          <option value="">Wszystkie</option>
          <option value={new Date(Date.now() - 86400000).toISOString()}>Ostatnie 24h</option>
          <option value={new Date(Date.now() - 604800000).toISOString()}>Ostatni tydzień</option>
          <option value={new Date(Date.now() - 2592000000).toISOString()}>Ostatni miesiąc</option>
        </select>
      </div>
    </div>
  );
}
