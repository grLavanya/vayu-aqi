import { useMemo } from 'react';
import { useSearchParams } from '../lib/searchParams';
import type { Mood } from '@/lib/mood';
import { MOODS } from '@/lib/mood';

interface DevBandSwitcherProps {
  onSelect: (mood: Mood, aqi: number) => void;
}

const SAMPLE_AQI: Record<Mood, number> = {
  clear: 50,
  hazy: 150,
  heavy: 250,
  dense: 350,
};

export default function DevBandSwitcher({ onSelect }: DevBandSwitcherProps) {
  const [params] = useSearchParams();
  const visible = useMemo(() => params.get('dev') === '1', [params]);
  if (!visible) return null;

  return (
    <div
      role="toolbar"
      aria-label="Preview air quality bands"
      className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/80 px-2 py-1.5 shadow-lg"
    >
      {MOODS.map((mood) => (
        <button
          key={mood.id}
          type="button"
          onClick={() => onSelect(mood.id, SAMPLE_AQI[mood.id])}
          className="rounded-full px-3 py-1 text-xs font-medium text-white transition hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white"
        >
          {mood.label}
        </button>
      ))}
    </div>
  );
}
