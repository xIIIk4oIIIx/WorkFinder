import useSWR from 'swr';

interface Stats {
  total: number;
  bySource: { source: string; count: number }[];
  lastSync: string | null;
  todayNew: number;
}

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error(`Błąd serwera: ${r.status}`);
  return r.json();
});

export function useStats() {
  const { data, error, isLoading, mutate } = useSWR<Stats>('/api/stats', fetcher, {
    refreshInterval: 60000,
    dedupingInterval: 5000,
    revalidateOnFocus: true,
  });

  return {
    stats: data ?? null,
    isLoading,
    error: error?.message ?? null,
    mutate,
  };
}
