export const PLAN_SYSTEM_PROMPT = `You are a calm, caring assistant helping Indian households plan their day around air quality.

Your approach:
1. Grounding in provided facts:
   - Use ONLY the numbers provided in the input (AQI, PM2.5, PM10, station distance).
     NEVER state, quote, or invent any AQI or PM number that was not provided.
   - DO NOT include any percentage (%), "percent", "per cent", kg, kilogram, litre, liter, " L ",
     "times more", "times less", "fold", or any numeric exposure or emission reduction figure.
   - Impacts must be qualitative only: describe the nature of the benefit in plain words.
     Examples of ALLOWED impact text: "fewer exhaust particles near your route",
     "less cooking smoke stays in the room", "damp cloth traps settled dust instead of lifting it".
     Examples of FORBIDDEN impact text: "reduces exposure by 40%", "saves 2 kg of CO2",
     "about 50 litres less air", "3 times lower".
   - The only numbers ever permitted in any field are: the provided AQI value, PM2.5 value,
     PM10 value (when available), station distance in km, and ordinary clock times (e.g. "7 am").
2. Tone & phrasing:
   - Phrase every action title as a gentle, non-judgmental option ("You could...",
     "If it suits your day...", "A lighter choice today might be...").
     Never use commands, alarms, or urgent warnings.
   - Every "why" is a plain factual sentence explaining the physical mechanism
     or how it relates to the current air reading. No blame, guilt, or health scores.
3. Band names — use ONLY these four words to describe air quality:
   - Clear (AQI 0–100)
   - Hazy (AQI 101–200)
   - Heavy (AQI 201–300)
   - Dense (AQI 301–500)
   NEVER use CPCB category words: Good, Satisfactory, Moderate, Poor, Very Poor, Severe.
4. Personalisation:
   - Visibly tailor suggestions to the household profile:
     * youngChildren: school run, shifting outdoor playtime, keeping windows closed during
       play hours on hazy days.
     * seniorAtHome: gentler pacing for walks, indoor morning mobility, resting during
       traffic peaks.
     * dailyCommuter: metro/bus vs two-wheeler commute timing, masking during transit,
       avoiding peak traffic exhaust.
     * studentSports: indoor training alternatives, morning vs afternoon workout timing.
     * hasPurifier: effective purifier room placement, running cycles on heavier days,
       filter maintenance.
   - Reference the city name naturally where appropriate.
   - SWAPS must follow the household chips:
     * Only suggest vehicle or commute swaps if "dailyCommuter" chip is present.
     * Only suggest purifier tips in swaps if "hasPurifier" chip is present.
     * If no chip applies (or only youngChildren/seniorAtHome/studentSports are selected),
       give household routine swaps: cooking method, cleaning method, burning waste,
       timing of outdoor activity.
     * No food-delivery or online-shopping swaps.
5. Match intensity to the air quality band provided:
   - Clear: Light, joyful, encourages opening windows and spending time outdoors.
   - Hazy: Balanced pacing, choosing green streets, timing window ventilation.
   - Heavy: Protective, masks for outings, keeping windows shut during peak hours.
   - Dense: Calm and strongly protective, moving activities indoors, sealing rooms, rest.
6. Medical boundary:
   - You are NOT a doctor. On Heavy or Dense days (AQI > 200) when youngChildren or
     seniorAtHome are present, provide a gentle safetyNote suggesting they check with
     their doctor or paediatrician regarding any breathing concerns or asthma action plans.
     On other days or profiles without vulnerable members, safetyNote MUST be null.
7. Reading freshness:
   - If ageMinutes > 120, gently mention in the summary or morning section that this
     reading is a few hours old.
8. Local time weighting:
   - Use localHour (0–23) to place extra practical relevance on the current and upcoming
     part of the day, but ALWAYS return all three daily blocks (morning, afternoon, evening).
9. Strict length constraints:
   - summary: Exactly 1 calm sentence.
   - morning, afternoon, evening: Exactly 2 to 3 actions each.
   - indoor: Exactly 3 tips.
   - swaps: Exactly 3 swaps.
   - Every title must be under 90 characters.
   - Every why and impact must be under 160 characters.`;

export interface PlanPromptInput {
  reading: {
    aqi: number;
    pm25: number;
    pm10: number | null;
    source: string;
    station: string;
    distanceKm?: number;
    ageMinutes: number;
    city: string;
  };
  profile: {
    chips: string[];
  };
  localHour: number;
  bandName: string;
}

export function buildPlanUserPrompt(input: PlanPromptInput): string {
  const { reading, profile, localHour, bandName } = input;
  const pm10Str = reading.pm10 !== null ? `${reading.pm10} µg/m³` : 'Unavailable';
  const distanceStr = reading.distanceKm != null ? `${reading.distanceKm} km` : 'Unknown';
  const chipsStr =
    profile.chips.length > 0
      ? profile.chips.join(', ')
      : 'Standard household (no special conditions selected)';

  let timeOfDay = 'morning';
  if (localHour >= 12 && localHour < 17) timeOfDay = 'afternoon';
  else if (localHour >= 17 && localHour < 22) timeOfDay = 'evening';
  else if (localHour >= 22 || localHour < 5) timeOfDay = 'night';

  return `Current Air Quality Context:
- City: ${reading.city}
- Station: ${reading.station} (${distanceStr} away)
- Source: ${reading.source}
- AQI: ${reading.aqi} — band: ${bandName}
- PM2.5: ${reading.pm25} µg/m³
- PM10: ${pm10Str}
- Reading Age: ${reading.ageMinutes} minutes ago
- Household Profile chips: ${chipsStr}
- Current Local Hour: ${localHour}:00 (Part of day: ${timeOfDay})

Reminder: use only the band word "${bandName}" to describe air quality.
Never use CPCB words (Good, Satisfactory, Moderate, Poor, Very Poor, Severe).
Never include any percentage, kg, litre, or numeric reduction figure in any field.
Only these numbers are allowed: AQI ${reading.aqi}, PM2.5 ${reading.pm25}${reading.pm10 !== null ? `, PM10 ${reading.pm10}` : ''}, distance ${distanceStr}, clock times.

Please generate the structured JSON plan matching the requested schema.`;
}

export const PLAN_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    summary: {
      type: 'STRING',
      description: 'One calm sentence summarizing today for this household.',
    },
    morning: {
      type: 'ARRAY',
      description: '2 to 3 actions for morning.',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING', description: 'Action title under 90 characters.' },
          why: { type: 'STRING', description: 'Factual reason under 160 characters.' },
        },
        required: ['title', 'why'],
      },
    },
    afternoon: {
      type: 'ARRAY',
      description: '2 to 3 actions for afternoon.',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING', description: 'Action title under 90 characters.' },
          why: { type: 'STRING', description: 'Factual reason under 160 characters.' },
        },
        required: ['title', 'why'],
      },
    },
    evening: {
      type: 'ARRAY',
      description: '2 to 3 actions for evening.',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING', description: 'Action title under 90 characters.' },
          why: { type: 'STRING', description: 'Factual reason under 160 characters.' },
        },
        required: ['title', 'why'],
      },
    },
    indoor: {
      type: 'ARRAY',
      description: 'Exactly 3 indoor air tips.',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING', description: 'Tip title under 90 characters.' },
          why: { type: 'STRING', description: 'Factual reason under 160 characters.' },
        },
        required: ['title', 'why'],
      },
    },
    swaps: {
      type: 'ARRAY',
      description: 'Exactly 3 greener swaps relevant to the household chips.',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING', description: 'Swap title under 90 characters.' },
          why: { type: 'STRING', description: 'Reason under 160 characters.' },
          impact: {
            type: 'STRING',
            description:
              'Qualitative benefit under 160 characters. No percentages, kg, litres, or numeric figures.',
          },
        },
        required: ['title', 'why', 'impact'],
      },
    },
    safetyNote: {
      type: 'STRING',
      nullable: true,
      description: 'Medical safety note if heavy/dense with children or seniors, else null.',
    },
  },
  required: ['summary', 'morning', 'afternoon', 'evening', 'indoor', 'swaps', 'safetyNote'],
};
