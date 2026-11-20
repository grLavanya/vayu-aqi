import { useEffect, useMemo, useState } from 'react';
import LocationBar from './components/LocationBar';
import AqiHero from './components/AqiHero';
import ProfileChips from './components/ProfileChips';
import PlanSheet from './components/PlanSheet';
import InfoSections from './components/InfoSections';
import DevBandSwitcher from './components/DevBandSwitcher';
import Sheet from './components/Sheet';
import { getAqi, type AqiReading } from '@/lib/aqiService';
import {
  EMPTY_PROFILE,
  getPlan,
  type HouseholdProfile,
  type Plan,
} from '@/lib/planService';
import { moodFromAqi, type Mood } from '@/lib/mood';


export default function App() {
  const [baseReading, setReading] = useState<AqiReading | null>(null);
  const [profile, setProfile] = useState<HouseholdProfile>(EMPTY_PROFILE);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [devAqi, setDevAqi] = useState<number | null>(null);

  useEffect(() => {
    void getAqi('Bengaluru').then(setReading);
  }, []);

  const reading = useMemo<AqiReading | null>(
    () => (baseReading && devAqi !== null ? { ...baseReading, aqi: devAqi } : baseReading),
    [baseReading, devAqi],
  );

  useEffect(() => {
    if (!reading) return;
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
          <h1 className="text-3xl font-bold tracking-tight">Saans</h1>
          <LocationBar reading={reading} onChange={setReading} />
        </header>

        <main className="flex flex-col gap-6">
          {reading && (
            <Sheet className="p-8">
              <AqiHero reading={reading} />
            </Sheet>
          )}

          <Sheet className="p-6">
            <ProfileChips profile={profile} onChange={setProfile} />
          </Sheet>

          <PlanSheet plan={plan} />
          <InfoSections plan={plan} />
        </main>

        <footer className="pb-16 text-center text-xs opacity-60">
          Saans informs, it doesn't replace medical advice.
        </footer>
      </div>

      <DevBandSwitcher onSelect={handleDevMood} />
    </div>
  );
}
