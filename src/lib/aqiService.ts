export interface AqiReading {
  aqi: number;
  pm25: number;
  pm10: number | null;
  city: string;
  source: string;
  station: string;
  distanceKm: number;
  timestamp: number;
  fallbackReason?: string;
  keyPresent?: boolean;
}

export interface LocationSuggestion {
  id: number;
  name: string;
  admin1?: string;
  latitude: number;
  longitude: number;
}

export interface SavedLocation {
  name: string;
  latitude: number;
  longitude: number;
}

const STORAGE_KEY = 'vayu_last_location';

export function saveLastLocation(location: SavedLocation): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(location));
  } catch {
    // Ignore localStorage write failures (e.g. private browsing)
  }
}

export function getLastLocation(): SavedLocation | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof parsed.name === 'string' &&
      typeof parsed.latitude === 'number' &&
      typeof parsed.longitude === 'number'
    ) {
      return parsed as SavedLocation;
    }
  } catch {
    // Ignore parse or storage errors
  }
  return null;
}

/**
 * Search locations using Open-Meteo free geocoding API, restricted to India.
 */
export async function searchLocations(
  query: string,
): Promise<LocationSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    trimmed,
  )}&count=10&language=en&format=json`;

  const res = await fetch(url);
  if (!res.ok) return [];

  const data = await res.json();
  const results = Array.isArray(data.results) ? data.results : [];

  // Filter for India results
  const indiaResults = results.filter((r: any) => {
    return (
      r.country_code === 'IN' ||
      r.country?.toLowerCase() === 'india' ||
      (typeof r.latitude === 'number' &&
        r.latitude >= 6 &&
        r.latitude <= 37 &&
        typeof r.longitude === 'number' &&
        r.longitude >= 68 &&
        r.longitude <= 98)
    );
  });

  return indiaResults.map((r: any) => ({
    id: r.id,
    name: r.name,
    admin1: r.admin1,
    latitude: r.latitude,
    longitude: r.longitude,
  }));
}

/**
 * Fetch live AQI reading from the /api/aqi serverless proxy.
 */
export async function fetchAqiByCoords(
  lat: number,
  lon: number,
  city?: string,
): Promise<AqiReading> {
  const params = new URLSearchParams({
    lat: lat.toString(),
    lon: lon.toString(),
  });
  if (city) {
    params.set('city', city);
  }

  const res = await fetch(`/api/aqi?${params.toString()}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.error || "We couldn't fetch the air reading right now",
    );
  }

  return (await res.json()) as AqiReading;
}

/**
 * Convenience helper to geocode city name and fetch AQI.
 */
export async function getAqi(city: string): Promise<AqiReading> {
  const locations = await searchLocations(city);
  if (locations.length === 0) {
    throw new Error(`Could not find location in India for "${city}"`);
  }
  const top = locations[0];
  const reading = await fetchAqiByCoords(top.latitude, top.longitude, top.name);
  saveLastLocation({
    name: top.name,
    latitude: top.latitude,
    longitude: top.longitude,
  });
  return reading;
}
