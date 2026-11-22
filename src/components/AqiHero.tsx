import type { AqiReading } from '@/lib/aqiService';
import { moodFromAqi, moodInfo } from '@/lib/mood';
import { useIsDevMode } from '@/lib/searchParams';

interface AqiHeroProps {
  reading: AqiReading;
}

function formatUpdatedAgo(ts: number): string {
  if (!ts) return 'recently';
  const diffSec = Math.floor((Date.now() - ts) / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60)
    return `${diffMin} ${diffMin === 1 ? 'minute' : 'minutes'} ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24)
    return `${diffHour} ${diffHour === 1 ? 'hour' : 'hours'} ago`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay} ${diffDay === 1 ? 'day' : 'days'} ago`;
}

export default function AqiHero({ reading }: AqiHeroProps) {
  const isDev = useIsDevMode();
  const mood = moodInfo(moodFromAqi(reading.aqi));
  const isModelled = reading.source.toLowerCase().includes('open-meteo');

  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <div
        className="text-[5.5rem] font-extrabold leading-none tracking-tight transition-colors duration-[600ms] sm:text-[7rem]"
        style={{ color: 'var(--mood-accent)' }}
      >
        {reading.aqi}
      </div>
      <div className="text-2xl font-semibold tracking-tight">{mood.label}</div>
      <p className="max-w-md text-base leading-relaxed opacity-80">
        {mood.sentence}
      </p>

      <div className="mt-3 flex flex-col items-center gap-1 text-xs opacity-70">
        <p>
          Source: {reading.source} · Station: {reading.station}
          {reading.distanceKm > 0
            ? ` (${reading.distanceKm} km away)`
            : ''} · Updated {formatUpdatedAgo(reading.timestamp)}
        </p>
        <p className="text-[11px] opacity-75">
          CPCB AQI estimated from the latest PM2.5/PM10 reading
        </p>
        {isModelled && (
          <p className="mt-1 text-[11px] opacity-80">
            Air quality data from Copernicus Atmosphere Monitoring Service via{' '}
            <a
              href="https://open-meteo.com/"
              target="_blank"
              rel="noreferrer"
              className="underline hover:opacity-100"
            >
              Open-Meteo
            </a>
          </p>
        )}
        {isDev && reading.fallbackReason && (
          <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] text-amber-900">
            <span className="font-semibold uppercase tracking-wider text-[10px] text-amber-700">
              Dev Fallback:
            </span>
            <span>{reading.fallbackReason}</span>
            {typeof reading.keyPresent === 'boolean' && (
              <span className="opacity-75">
                ({reading.keyPresent ? 'key present' : 'key missing'})
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
