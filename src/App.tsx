import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, RotateCw, Wind } from 'lucide-react';
import LocationBar from './components/LocationBar';
import AqiHero from './components/AqiHero';
import ProfileChips from './components/ProfileChips';
import PlanSheet from './components/PlanSheet';
import InfoSections from './components/InfoSections';
import DevBandSwitcher from './components/DevBandSwitcher';
import Sheet from './components/Sheet';
import {
  fetchAqiByCoords,
  getLastLocation,
  saveLastLocation,
  type AqiReading,
} from '@/lib/aqiService';
import {
  EMPTY_PROFILE,
  getPlan,
  type HouseholdProfile,
  type Plan,
} from '@/lib/planService';
import { moodFromAqi, type Mood } from '@/lib/mood';

interface LastAttempt {
  lat: number;
  lon: number;
  city: string;
}

export default function App() {
  const [baseReading, setReading] = useState<AqiReading | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAttempt, setLastAttempt] = useState<LastAttempt | null>(null);

  const [profile, setProfile] = useState<HouseholdProfile>(EMPTY_PROFILE);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [devAqi, setDevAqi] = useState<number | null>(null);

  const handleSelectLocation = useCallback(
    async (lat: number, lon: number, cityName: string) => {
      setLoading(true);
      setError(null);
      setLastAttempt({ lat, lon, city: cityName });

      try {
        const next = await fetchAqiByCoords(lat, lon, cityName);
        setReading(next);
        saveLastLocation({
          name: next.city || cityName,
          latitude: lat,
          longitude: lon,
        });
      } catch (err: any) {
        setError(
          err.message || "We couldn't fetch the air reading right now",
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // On first load: do NOT default to any city.
  // Reload last selected location from localStorage if saved.
  useEffect(() => {
    const saved = getLastLocation();
    if (saved) {
      void handleSelectLocation(saved.latitude, saved.longitude, saved.name);
    }
  }, [handleSelectLocation]);

  const reading = useMemo<AqiReading | null>(
    () =>
      baseReading && devAqi !== null
        ? { ...baseReading, aqi: devAqi }
        : baseReading,
    [baseReading, devAqi],
  );

  useEffect(() => {
    if (!reading) {
      setPlan(null);
      return;
    }
    void getPlan(reading, profile).then(setPlan);
  }, [reading, profile]);

  const mood = reading ? moodFromAqi(reading.aqi) : 'clear';

  useEffect(() => {
    document.documentElement.setAttribute('data-mood', mood);
  }, [mood]);

  const handleDevMood = (_next: Mood, aqi: number) => setDevAqi(aqi);

  return (
    <div className="relative min-h-screen text-[var(--mood-ink)]">
      <div className="haze-root" aria-hidden="true">
        <div className="haze-layer haze-band-top" />
        <div className="haze-layer haze-band-mid" />
        <div className="haze-layer haze-pocket-one" />
        <div className="haze-layer haze-pocket-two" />
      </div>

      <div className="relative z-10 mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
        <header className="flex flex-col gap-6">
          <h1 className="flex items-center gap-2.5 text-3xl font-bold tracking-tight">
            <Wind
              className="h-7 w-7"
              style={{ color: 'var(--mood-accent)' }}
              aria-hidden="true"
            />
            <span>Vayu</span>
          </h1>
          <LocationBar
            reading={reading}
            onSelectLocation={handleSelectLocation}
            loading={loading}
          />
        </header>

        <main className="flex flex-col gap-6">
          {/* Hero area: Loading, Error, Reading, or Calm Empty State */}
          {loading ? (
            <Sheet className="flex flex-col items-center justify-center p-10 text-center">
              <RotateCw
                className="h-8 w-8 animate-spin opacity-60"
                style={{ color: 'var(--mood-accent)' }}
              />
              <p className="mt-3 text-sm font-medium opacity-75">
                Fetching air quality reading…
              </p>
            </Sheet>
          ) : error ? (
            <Sheet className="p-8 text-center">
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <h2 className="text-xl font-bold tracking-tight">
                  We couldn't fetch the air reading right now
                </h2>
                <p className="max-w-md text-sm opacity-70">
                  {error}
                </p>
                {lastAttempt && (
                  <button
                    type="button"
                    onClick={() =>
                      void handleSelectLocation(
                        lastAttempt.lat,
                        lastAttempt.lon,
                        lastAttempt.city,
                      )
                    }
                    className="mt-2 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--mood-accent)]"
                    style={{ backgroundColor: 'var(--mood-accent)' }}
                  >
                    <RotateCw className="h-4 w-4" />
                    Retry
                  </button>
                )}
              </div>
            </Sheet>
          ) : reading ? (
            <Sheet className="p-8">
              <AqiHero reading={reading} />
            </Sheet>
          ) : (
            <Sheet className="p-8 text-center">
              <div className="flex flex-col items-center gap-3 py-4">
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-black/[0.04]"
                  style={{ color: 'var(--mood-accent)' }}
                >
                  <Wind className="h-7 w-7" />
                </div>
                <h2 className="text-xl font-bold tracking-tight">
                  Choose your city or use your location to see today's air
                </h2>
                <p className="max-w-md text-sm leading-relaxed opacity-70">
                  Search for any city in India or tap &ldquo;Use my location&rdquo; to
                  view live air quality and gentle, actionable recommendations.
                </p>
              </div>
            </Sheet>
          )}

          {/* Household Profile */}
          <Sheet className="p-6">
            <ProfileChips profile={profile} onChange={setProfile} />
          </Sheet>

          {/* Today's plan & Tips (visible once reading is available) */}
          {reading && (
            <>
              <PlanSheet plan={plan} />
              <InfoSections plan={plan} />
            </>
          )}
        </main>

        <footer className="pb-16 text-center text-xs opacity-60">
          Vayu informs, it doesn't replace medical advice.
        </footer>
      </div>

      <DevBandSwitcher onSelect={handleDevMood} />
    </div>
  );
}
