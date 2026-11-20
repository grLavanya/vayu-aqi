import type { AqiReading } from '@/lib/aqiService';
import { moodFromAqi, moodInfo } from '@/lib/mood';

interface AqiHeroProps {
  reading: AqiReading;
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function AqiHero({ reading }: AqiHeroProps) {
  const mood = moodInfo(moodFromAqi(reading.aqi));

  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <div
        className="text-[5.5rem] font-extrabold leading-none tracking-tight transition-colors duration-[600ms] sm:text-[7rem]"
        style={{ color: 'var(--mood-accent)' }}
      >
        {reading.aqi}
      </div>
      <div className="text-2xl font-semibold tracking-tight">{mood.label}</div>
      <p className="max-w-md text-base leading-relaxed opacity-80">{mood.sentence}</p>
      <p className="mt-2 text-xs opacity-60">
        Source: {reading.source} · Station: {reading.station} · Updated {formatTime(reading.timestamp)}
      </p>
    </div>
  );
}
