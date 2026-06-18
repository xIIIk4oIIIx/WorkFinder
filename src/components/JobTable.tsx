'use client';

interface Job {
  id: string;
  title: string;
  company: string;
  city: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  technologies: string[];
  workMode: string | null;
  source: string;
  sourceUrl: string;
  publishedAt: string | null;
}

interface JobTableProps {
  jobs: Job[];
  total: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function JobTable({ jobs, total, page, totalPages, onPageChange }: JobTableProps) {
  const formatSalary = (min: number | null, max: number | null, currency: string | null) => {
    if (!min && !max) return 'Brak danych';
    const fmt = (n: number) => n.toLocaleString('pl-PL');
    if (min && max) return `${fmt(min)} - ${fmt(max)} ${currency ?? 'PLN'}`;
    if (min) return `od ${fmt(min)} ${currency ?? 'PLN'}`;
    return `do ${fmt(max!)} ${currency ?? 'PLN'}`;
  };

  const workModeLabel = (mode: string | null) => {
    const labels: Record<string, string> = { remote: 'Zdalnie', office: 'Stacjonarnie', hybrid: 'Hybrydowo' };
    return labels[mode ?? ''] ?? mode ?? 'Nieokreślony';
  };

  return (
    <div>
      <div className="mb-2 text-sm text-gray-600">Łącznie: {total} ofert</div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-3 text-left">Firma</th>
              <th className="p-3 text-left">Tytuł</th>
              <th className="p-3 text-left">Lokalizacja</th>
              <th className="p-3 text-left">Zarobki</th>
              <th className="p-3 text-left">Technologie</th>
              <th className="p-3 text-left">Tryb</th>
              <th className="p-3 text-left">Źródło</th>
              <th className="p-3 text-left">Data</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id} className="border-b hover:bg-gray-50">
                <td className="p-3 font-medium">{job.company}</td>
                <td className="p-3">
                  <a href={job.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    {job.title}
                  </a>
                </td>
                <td className="p-3">{job.city ?? '—'}</td>
                <td className="p-3">{formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency)}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {job.technologies.slice(0, 3).map((tech) => (
                      <span key={tech} className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">
                        {tech}
                      </span>
                    ))}
                    {job.technologies.length > 3 && (
                      <span className="text-xs text-gray-500">+{job.technologies.length - 3}</span>
                    )}
                  </div>
                </td>
                <td className="p-3">{workModeLabel(job.workMode)}</td>
                <td className="p-3 text-sm text-gray-500">{job.source}</td>
                <td className="p-3 text-sm text-gray-500">
                  {job.publishedAt ? new Date(job.publishedAt).toLocaleDateString('pl-PL') : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Poprzednia
          </button>
          <span className="px-3 py-1">
            Strona {page} z {totalPages}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Następna
          </button>
        </div>
      )}
    </div>
  );
}
