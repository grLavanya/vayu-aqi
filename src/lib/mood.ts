export type Mood = 'clear' | 'hazy' | 'heavy' | 'dense';

export interface MoodInfo {
  id: Mood;
  label: string;
  range: string;
  sentence: string;
}

export const MOODS: MoodInfo[] = [
  {
    id: 'clear',
    label: 'Clear',
    range: '0–100',
    sentence: 'The air is easy to be in today — a good day to spend time outside.',
  },
  {
    id: 'hazy',
    label: 'Hazy',
    range: '101–200',
    sentence: "There's a light haze in the air; most of your day can stay as planned.",
  },
  {
    id: 'heavy',
    label: 'Heavy',
    range: '201–300',
    sentence: 'The air feels heavy today — a little care goes a long way.',
  },
  {
    id: 'dense',
    label: 'Dense',
    range: '301+',
    sentence: 'The air is dense today. A few small choices can make the day gentler.',
  },
];

export function moodFromAqi(aqi: number): Mood {
  if (aqi <= 100) return 'clear';
  if (aqi <= 200) return 'hazy';
  if (aqi <= 300) return 'heavy';
  return 'dense';
}

export function moodInfo(mood: Mood): MoodInfo {
  return MOODS.find((m) => m.id === mood) ?? MOODS[0];
}
