import { moodFromAqi, type Mood } from './mood';

export interface PlanAction {
  title: string;
  why: string;
}

export interface Swap {
  title: string;
  why: string;
  impact: string;
}

export interface Plan {
  summary: string;
  morning: PlanAction[];
  afternoon: PlanAction[];
  evening: PlanAction[];
  indoor: PlanAction[];
  swaps: Swap[];
  safetyNote: string | null;
  planSource?: 'gemini' | 'rules';
  model?: string;
  cacheHit?: boolean;
}

const MORNING: Record<Mood, PlanAction[]> = {
  clear: [
    {
      title: 'You could open the windows for an hour this morning.',
      why: 'Outdoor air this fresh is one of the easiest ways to air out your home.',
    },
    {
      title: 'If it suits your day, a morning walk or cycle ride is a lovely choice.',
      why: 'Cleaner air means your body gets more benefit from every breath outdoors.',
    },
  ],
  hazy: [
    {
      title: 'You might wait for the sun to rise before opening the windows.',
      why: 'Haze often settles overnight and thins a little as the day warms up.',
    },
    {
      title: 'A lighter choice today might be a walk on a quieter, greener street.',
      why: 'Streets away from main traffic usually hold a little less dust and smoke.',
    },
  ],
  heavy: [
    {
      title: 'If it suits your day, you could keep windows closed until late morning.',
      why: 'Haze tends to be thickest in the early hours, before the air has had time to move.',
    },
    {
      title: 'You could carry a well-fitted N95 or FFP2 mask in your bag.',
      why: 'A snugly fitted respirator mask filters out most of the fine particles in heavy air.',
    },
  ],
  dense: [
    {
      title: 'You could keep windows closed today and let the air inside settle.',
      why: 'On dense days the air outdoors carries many more fine particles than indoors.',
    },
    {
      title: 'If someone in the family heads out, a well-fitted N95 mask is a kind companion.',
      why: 'Respirator masks filter the fine particles that make dense air hardest to breathe.',
    },
  ],
};

const AFTERNOON: Record<Mood, PlanAction[]> = {
  clear: [
    {
      title: 'You could plan a picnic, park visit or outdoor game this afternoon.',
      why: 'This is the kind of air where time outside is purely a pleasure.',
    },
    {
      title: 'If it suits your day, airing laundry outdoors is wonderful today.',
      why: 'Sunlight and clear breeze naturally refresh fabrics without dust.',
    },
  ],
  hazy: [
    {
      title: 'If it suits your day, an afternoon outing often feels easier than an early one.',
      why: 'The air usually lightens a little through the middle of the day.',
    },
    {
      title: 'You could take regular water sips during afternoon errands.',
      why: 'Staying hydrated helps keep airways moist and comfortable in hazy weather.',
    },
  ],
  heavy: [
    {
      title: 'You might keep outdoor time short and choose shaded, leafy spots.',
      why: 'Fewer hours in heavy air means fewer fine particles reaching the lungs.',
    },
    {
      title: 'If elders at home step out, a companion and a slower pace can help.',
      why: 'Older lungs respond more strongly to particle pollution over long stretches.',
    },
  ],
  dense: [
    {
      title: 'You could shift errands and outings to another day if you can.',
      why: 'On dense days, every hour outdoors adds up — indoors stays noticeably gentler.',
    },
    {
      title: 'A lighter choice today might be indoor games or living-room reading for children.',
      why: 'Limiting outdoor time on dense days reduces the particles young lungs take in.',
    },
  ],
};

const EVENING: Record<Mood, PlanAction[]> = {
  clear: [
    {
      title: 'You could leave the windows open through the evening.',
      why: 'Cool evening air keeps the home fresh without any effort.',
    },
    {
      title: 'If it suits your day, an evening terrace stroll is a gentle choice.',
      why: 'Clear skies and calm air make an evening unwind easy.',
    },
  ],
  hazy: [
    {
      title: 'If it suits your day, you might close the windows after sunset.',
      why: 'Haze often thickens again in the evening as traffic peaks and the air cools.',
    },
    {
      title: 'A warm shower or washing face and eyes after getting home can feel soothing.',
      why: 'Rinsing lifts fine particulate matter settled on skin during the day.',
    },
  ],
  heavy: [
    {
      title: 'You could close the windows before the evening traffic peak.',
      why: 'Vehicle exhaust adds a fresh layer of particles to the evening air.',
    },
    {
      title: 'If it suits your day, an indoor workout or yoga session fits well tonight.',
      why: 'Exercising in filtered indoor air keeps deeper breathing clean.',
    },
  ],
  dense: [
    {
      title: 'You might keep the windows closed tonight and air the home tomorrow morning.',
      why: 'Evening haze on dense days can linger overnight, especially near busy roads.',
    },
    {
      title: 'If it suits your day, a quiet evening at home is a gentle plan.',
      why: 'Indoor air stays measurably cleaner than outdoor air when windows stay closed.',
    },
  ],
};

const INDOOR: PlanAction[] = [
  {
    title: 'You could wipe down surfaces near open windows with a damp cloth.',
    why: 'Dust settles near where air enters, and a damp cloth lifts it without stirring it.',
  },
  {
    title: 'If it suits your day, you might run the kitchen chimney while cooking.',
    why: 'Cooking, especially frying, is one of the biggest short-term sources of indoor particles.',
  },
  {
    title: 'You could keep the purifier on in the room where the family spends the most time.',
    why: 'A purifier cleans the room it is placed in far better than an entire house.',
  },
];

const SWAPS: Swap[] = [
  {
    title: 'Swap one short drive for a gentle walk.',
    why: 'Short vehicle trips contribute concentrated roadside emissions.',
    impact: 'Roughly one kilometre of vehicle exhaust kept out of your neighbourhood.',
  },
  {
    title: 'Swap a car idle for a quick switch-off.',
    why: 'Idling engines release exhaust without moving.',
    impact: 'About ten minutes less idling saves roughly half a litre of fuel a week.',
  },
  {
    title: 'Swap an aerosol spray for simple soap and water.',
    why: 'Aerosol propellants add fine droplets directly into indoor air.',
    impact: 'Noticeably lower volatile organic compounds inside living spaces.',
  },
];

const SUMMARIES: Record<Mood, string> = {
  clear: 'Outdoor air is pleasantly fresh today — a lovely day for open windows and outdoor activities.',
  hazy: 'A mild haze is in the air today; timing outings around midday keeps breathing easy.',
  heavy: 'The air carries noticeable particles today; keeping windows closed during traffic peaks is a helpful choice.',
  dense: 'Air outdoors is quite dense today; relaxing indoors and keeping rooms sealed protects everyone at home.',
};

export interface RulePlanInput {
  aqi: number;
  chips?: string[];
  city?: string;
  localHour?: number;
}

export function generateRulePlan(input: RulePlanInput): Plan {
  const { aqi, chips = [] } = input;
  const mood = moodFromAqi(aqi);
  const chipSet = new Set(chips);

  const morning = [...MORNING[mood]];
  const afternoon = [...AFTERNOON[mood]];
  const evening = [...EVENING[mood]];

  // Customise actions based on chips
  if (chipSet.has('youngChildren')) {
    if (mood === 'clear') {
      morning.push({
        title: 'A morning park play or outdoor cycle ride is lovely for the children today.',
        why: 'Clear air lets developing lungs absorb maximum oxygen during physical play.',
      });
    } else {
      morning.push({
        title: 'A lighter choice today might be keeping little ones in for the worst morning hours.',
        why: 'Children breathe faster than adults, taking in more air per kilo of body weight.',
      });
    }
  }

  if (chipSet.has('seniorAtHome')) {
    if (mood === 'heavy' || mood === 'dense') {
      afternoon.push({
        title: 'You might help elders at home stay in through the peak traffic hours.',
        why: 'Heart and lungs in older adults respond more strongly to particle-heavy air.',
      });
    } else {
      afternoon.push({
        title: 'A slow shaded walk in a nearby garden or leafy courtyard is gentle choice.',
        why: 'Gentle mobility outdoors supports circulation without overtaxing breathing.',
      });
    }
  }

  if (chipSet.has('dailyCommuter')) {
    evening.push({
      title: 'If you commute, you might pick metro or bus over a two-wheeler ride today.',
      why: 'Closing yourself off from roadside air cuts down the exhaust you breathe directly.',
    });
  }

  if (chipSet.has('studentSports')) {
    if (mood === 'heavy' || mood === 'dense') {
      afternoon.push({
        title: 'If it suits your day, you could suggest moving intense sports training indoors.',
        why: 'Heavy breathing during cardio draws in far more fine particles when air is thick.',
      });
    }
  }

  if (chipSet.has('hasPurifier')) {
    if (mood === 'heavy' || mood === 'dense') {
      evening.push({
        title: 'You could give your air purifier a longer, continuous run in the bedroom.',
        why: 'Running purifiers continuously on dense days keeps indoor PM2.5 levels low.',
      });
    }
  }

  // Ensure blocks have 2 to 3 actions
  const finalMorning = morning.slice(0, 3);
  const finalAfternoon = afternoon.slice(0, 3);
  const finalEvening = evening.slice(0, 3);

  // Safety note for vulnerable groups on heavy/dense days
  let safetyNote: string | null = null;
  if (
    (mood === 'heavy' || mood === 'dense') &&
    (chipSet.has('youngChildren') || chipSet.has('seniorAtHome'))
  ) {
    safetyNote =
      'If anyone in your home experiences unusual wheezing, coughing, or tightness, consider consulting their doctor or paediatrician.';
  }

  return {
    summary: SUMMARIES[mood],
    morning: finalMorning,
    afternoon: finalAfternoon,
    evening: finalEvening,
    indoor: INDOOR.slice(0, 3),
    swaps: SWAPS.slice(0, 3),
    safetyNote,
    planSource: 'rules',
  };
}
