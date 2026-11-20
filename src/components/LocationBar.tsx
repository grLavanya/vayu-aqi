import { useEffect, useRef, useState } from 'react';
import { LocateFixed, Search } from 'lucide-react';
import { getAqi, type AqiReading } from '@/lib/aqiService';

interface LocationBarProps {
  reading: AqiReading | null;
  onChange: (reading: AqiReading) => void;
}

export default function LocationBar({ reading, onChange }: LocationBarProps) {
  const [query, setQuery] = useState('');
  const [locating, setLocating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function loadCity(city: string) {
    const next = await getAqi(city);
    onChange(next);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) void loadCity(query.trim());
  }

  function handleLocate() {
    if (!('geolocation' in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async () => {
        const next = await getAqi('Bengaluru');
        onChange(next);
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 8000 },
    );
  }

  useEffect(() => {
    if (!reading?.city) return;
    setQuery(reading.city);
  }, [reading?.city]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <form onSubmit={handleSubmit} className="relative flex-1" role="search">
        <label htmlFor="city-search" className="sr-only">
          Search for a city
        </label>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--mood-ink)]/50"
        />
        <input
          ref={inputRef}
          id="city-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for a city…"
          className="w-full rounded-full border border-black/10 bg-white/80 py-2.5 pl-10 pr-4 text-sm text-[var(--mood-ink)] shadow-sm outline-none transition focus:border-[var(--mood-accent)] focus:ring-2 focus:ring-[var(--mood-accent)]/30"
        />
      </form>
      <button
        type="button"
        onClick={handleLocate}
        disabled={locating}
        aria-label="Use my location"
        className="inline-flex items-center justify-center gap-2 rounded-full border border-black/10 bg-white/80 px-4 py-2.5 text-sm font-medium text-[var(--mood-ink)] shadow-sm outline-none transition hover:bg-white focus-visible:ring-2 focus-visible:ring-[var(--mood-accent)] disabled:opacity-60"
      >
        <LocateFixed aria-hidden="true" className="h-4 w-4" />
        {locating ? 'Finding you…' : 'Use my location'}
      </button>
    </div>
  );
}
