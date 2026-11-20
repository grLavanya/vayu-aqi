import { Check } from 'lucide-react';
import { EMPTY_PROFILE, type HouseholdProfile } from '@/lib/planService';

interface ProfileChipsProps {
  profile: HouseholdProfile;
  onChange: (profile: HouseholdProfile) => void;
}

const CHIP_FIELDS: { key: keyof HouseholdProfile; label: string }[] = [
  { key: 'youngChildren', label: 'Young children' },
  { key: 'seniorAtHome', label: 'Senior at home' },
  { key: 'dailyCommuter', label: 'Daily commuter' },
  { key: 'studentSports', label: 'Student/sports' },
  { key: 'hasPurifier', label: 'Has air purifier' },
];

const SAMPLE_PROFILES: { label: string; fields: Partial<HouseholdProfile> }[] = [
  { label: 'Working commuter', fields: { dailyCommuter: true } },
  { label: 'Family with two young children', fields: { youngChildren: true, hasPurifier: true } },
  { label: 'Senior at home', fields: { seniorAtHome: true } },
];

export default function ProfileChips({ profile, onChange }: ProfileChipsProps) {
  function toggle(key: keyof HouseholdProfile) {
    onChange({ ...profile, [key]: !profile[key] });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide opacity-60">
          Try a sample household
        </p>
        <div className="flex flex-wrap gap-2">
          {SAMPLE_PROFILES.map((sample) => (
            <button
              key={sample.label}
              type="button"
              onClick={() => onChange({ ...EMPTY_PROFILE, ...sample.fields })}
              className="rounded-full border border-[var(--mood-accent)]/40 bg-[var(--mood-accent)]/10 px-3.5 py-1.5 text-sm font-medium text-[var(--mood-ink)] transition hover:bg-[var(--mood-accent)]/20 focus-visible:ring-2 focus-visible:ring-[var(--mood-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--mood-bg)]"
            >
              {sample.label}
            </button>
          ))}
        </div>
      </div>
      <fieldset>
        <legend className="mb-2 text-xs font-medium uppercase tracking-wide opacity-60">
          Who's in your home? (optional)
        </legend>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Household profile">
          {CHIP_FIELDS.map(({ key, label }) => {
            const active = profile[key];
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                onClick={() => toggle(key)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition outline-none focus-visible:ring-2 focus-visible:ring-[var(--mood-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--mood-bg)] ${
                  active
                    ? 'border-transparent text-white shadow-sm'
                    : 'border-black/10 bg-white/70 text-[var(--mood-ink)] hover:bg-white'
                }`}
                style={active ? { backgroundColor: 'var(--mood-accent)' } : undefined}
              >
                {active && <Check aria-hidden="true" className="h-3.5 w-3.5" />}
                {label}
              </button>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}
