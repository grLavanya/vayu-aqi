import { useEffect, useRef, useState } from 'react';
import { LocateFixed, MapPin, Search } from 'lucide-react';
import {
  searchLocations,
  type AqiReading,
  type LocationSuggestion,
} from '@/lib/aqiService';

interface LocationBarProps {
  reading: AqiReading | null;
  onSelectLocation: (lat: number, lon: number, cityName: string) => Promise<void>;
  loading?: boolean;
}

export default function LocationBar({
  reading,
  onSelectLocation,
  loading = false,
}: LocationBarProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!reading?.city) return;
    setQuery(reading.city);
  }, [reading?.city]);

  // Click outside listener to dismiss suggestions
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced geocoding search
  function handleQueryChange(value: string) {
    setQuery(value);
    setErrorMsg(null);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (value.trim().length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    debounceTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchLocations(value);
        setSuggestions(results);
        setShowDropdown(results.length > 0);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 250);
  }

  async function handlePickSuggestion(item: LocationSuggestion) {
    setShowDropdown(false);
    setQuery(item.name);
    await onSelectLocation(item.latitude, item.longitude, item.name);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setShowDropdown(false);
    setSearching(true);
    try {
      const results =
        suggestions.length > 0 ? suggestions : await searchLocations(query.trim());
      if (results.length > 0) {
        const top = results[0];
        setQuery(top.name);
        await onSelectLocation(top.latitude, top.longitude, top.name);
      } else {
        setErrorMsg(`Could not find "${query}" in India. Try another city.`);
      }
    } catch {
      setErrorMsg('Error searching for locations. Please try again.');
    } finally {
      setSearching(false);
    }
  }

  function handleLocate() {
    if (!('geolocation' in navigator)) {
      setErrorMsg('Geolocation is not supported by your browser.');
      return;
    }

    setErrorMsg(null);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await onSelectLocation(
            pos.coords.latitude,
            pos.coords.longitude,
            '',
          );
        } catch {
          setErrorMsg("Could not fetch air data for your current location.");
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        setLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          setErrorMsg('Location permission was denied.');
        } else {
          setErrorMsg('Unable to retrieve your location. Try searching instead.');
        }
      },
      { timeout: 10000, enableHighAccuracy: false },
    );
  }

  return (
    <div ref={containerRef} className="relative flex flex-col gap-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form onSubmit={handleSubmit} className="relative flex-1" role="search">
          <label htmlFor="city-search" className="sr-only">
            Search for a city in India
          </label>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--mood-ink)]/50"
          />
          <input
            id="city-search"
            type="search"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onFocus={() => {
              if (suggestions.length > 0) setShowDropdown(true);
            }}
            placeholder="Search for a city in India…"
            autoComplete="off"
            className="w-full rounded-full border border-black/10 bg-white/80 py-2.5 pl-10 pr-4 text-sm text-[var(--mood-ink)] shadow-sm outline-none transition focus:border-[var(--mood-accent)] focus:ring-2 focus:ring-[var(--mood-accent)]/30"
          />
          {searching && (
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs opacity-50">
              Searching…
            </span>
          )}
        </form>

        <button
          type="button"
          onClick={handleLocate}
          disabled={locating || loading}
          aria-label="Use my location"
          className="inline-flex items-center justify-center gap-2 rounded-full border border-black/10 bg-white/80 px-4 py-2.5 text-sm font-medium text-[var(--mood-ink)] shadow-sm outline-none transition hover:bg-white focus-visible:ring-2 focus-visible:ring-[var(--mood-accent)] disabled:opacity-60"
        >
          <LocateFixed aria-hidden="true" className="h-4 w-4" />
          {locating ? 'Finding you…' : 'Use my location'}
        </button>
      </div>

      {/* Autocomplete dropdown */}
      {showDropdown && suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute left-0 top-12 z-50 max-h-60 w-full overflow-auto rounded-2xl border border-black/10 bg-white p-1.5 shadow-lg sm:max-w-md"
        >
          {suggestions.map((item) => (
            <li
              key={item.id}
              role="option"
              aria-selected={false}
              onClick={() => void handlePickSuggestion(item)}
              className="flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-[var(--mood-ink)] transition hover:bg-black/[0.05]"
            >
              <MapPin className="h-4 w-4 shrink-0 opacity-40" />
              <div className="flex flex-col">
                <span className="font-medium">{item.name}</span>
                {item.admin1 && (
                  <span className="text-xs opacity-60">{item.admin1}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {errorMsg && (
        <p className="px-2 text-xs text-rose-600">{errorMsg}</p>
      )}
    </div>
  );
}
