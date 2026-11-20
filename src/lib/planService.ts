import type { AqiReading } from './aqiService';
import { moodFromAqi, type Mood } from './mood';

export interface HouseholdProfile {
  youngChildren: boolean;
  seniorAtHome: boolean;
  dailyCommuter: boolean;
  studentSports: boolean;
  hasPurifier: boolean;
}

export const EMPTY_PROFILE: HouseholdProfile = {
  youngChildren: false,
  seniorAtHome: false,
  dailyCommuter: false,
  studentSports: false,
  hasPurifier: false,
};

export interface PlanAction {
  title: string;
  why: string;
}

export interface IndoorTip {
  title: string;
  why: string;
}

export interface Swap {
  title: string;
  impact: string;
}

export interface Plan {
  morning: PlanAction[];
  afternoon: PlanAction[];
  evening: PlanAction[];
  indoor: IndoorTip[];
  swaps: Swap[];
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
      title: 'If someone in the family heads out, a well-fitted N95 or FFP2 mask is a kind companion.',
      why: 'Respirator masks filter the fine particles that make dense air hardest to breathe.',
    },
    {
      title: 'A lighter choice today might be moving outdoor play indoors for the children.',
      why: 'Young lungs breathe faster than adult lungs, so they take in more air — and more particles — per minute.',
    },
  ],
};

const AFTERNOON: Record<Mood, PlanAction[]> = {
  clear: [
    {
      title: 'You could plan a picnic, park visit or outdoor game this afternoon.',
      why: 'This is the kind of air where time outside is purely a pleasure.',
    },
  ],
  hazy: [
    {
      title: 'If it suits your day, an afternoon outing often feels easier than an early one.',
      why: 'The air usually lightens a little through the middle of the day.',
    },
  ],
  heavy: [
    {
      title: 'You might keep outdoor time short and choose shaded, leafy spots.',
      why: 'Fewer hours in heavy air means fewer fine particles reaching the lungs.',
    },
    {
      title: 'If elders at home step out, a companion and a slower pace can help.',
      why: 'Older lungs are more sensitive to particle pollution, especially over long stretches outdoors.',
    },
  ],
  dense: [
    {
      title: 'You could shift errands and outings to another day if you can.',
      why: 'On dense days, every hour outdoors adds up — indoors stays noticeably gentler.',
    },
    {
      title: 'A lighter choice today might be indoor games or a living-room picnic for the children.',
      why: 'Limiting outdoor time on dense days greatly reduces the particles young lungs take in.',
    },
  ],
};

const EVENING: Record<Mood, PlanAction[]> = {
  clear: [
    {
      title: 'You could leave the windows open through the evening.',
      why: 'Cool evening air keeps the home fresh without any effort.',
    },
  ],
  hazy: [
    {
      title: 'If it suits your day, you might close the windows after sunset.',
      why: 'Haze often thickens again in the evening as traffic peaks and the air cools.',
    },
  ],
  heavy: [
    {
      title: 'You could close the windows before the evening traffic peak.',
      why: 'Vehicle exhaust adds a fresh layer of particles to the evening air.',
    },
  ],
  dense: [
    {
      title: 'You might keep the windows closed tonight and air the home tomorrow morning.',
      why: 'Evening haze on dense days can linger overnight, especially near busy roads.',
    },
    {
      title: 'If it suits your day, a quiet evening at home is a gentle plan.',
      why: 'Indoor air stays measurably cleaner than outdoor air when windows stay closed on dense days.',
    },
  ],
};

function profileExtras(profile: HouseholdProfile, mood: Mood): PlanAction[] {
  const extras: PlanAction[] = [];
  if (profile.dailyCommuter) {
    extras.push({
      title: 'If you commute, you might pick the metro or a bus over a bike ride today.',
      why: 'Closing yourself off from roadside air, even briefly, cuts the particles you breathe most.',
    });
  }
  if (profile.youngChildren && (mood === 'heavy' || mood === 'dense')) {
    extras.push({
      title: 'A lighter choice today might be keeping the little ones in for the worst hours.',
      why: 'Children breathe more air per kilo of body weight than adults, so hazy hours weigh on them more.',
    });
  }
  if (profile.seniorAtHome && (mood === 'heavy' || mood === 'dense')) {
    extras.push({
      title: 'You might help elders at home stay in through the peak evening hours.',
      why: 'Heart and lungs in older adults respond more strongly to particle-heavy air.',
    });
  }
  if (profile.studentSports && (mood === 'heavy' || mood === 'dense')) {
    extras.push({
      title: 'If it suits your day, you could suggest moving sports practice indoors.',
      why: 'Deep breathing during exercise draws in far more particles when the air is thick.',
    });
  }
  if (profile.hasPurifier && (mood === 'heavy' || mood === 'dense')) {
    extras.push({
      title: 'You could give the purifier a longer run today.',
      why: 'Purifiers working longer on dense days keep indoor particle levels well below outdoor levels.',
    });
  }
  return extras;
}

const INDOOR: PlanAction[] = [
  {
    title: 'You could wipe down surfaces near open windows.',
    why: 'Dust settles near where the air enters, and a damp cloth lifts it instead of stirring it.',
  },
  {
    title: 'If it suits your day, you might run the kitchen chimney while cooking.',
    why: 'Cooking, especially frying, is one of the biggest short-term sources of indoor particles.',
  },
  {
    title: 'You could keep the purifier on in the room where the family spends the most time.',
    why: 'A purifier cleans the room it is in far better than the whole house.',
  },
];

const SWAPS: Swap[] = [
  {
    title: 'Swap one short drive for a walk.',
    impact: 'One less two-wheeler trip keeps roughly a kilometre of exhaust out of your street.',
  },
  {
    title: 'Swap a car idle for a switch-off.',
    impact: 'Ten minutes less idling each week saves about a litre of fuel a month.',
  },
  {
    title: 'Swap a pesticide spray for neem or soap water.',
    impact: 'Aerosol sprays add fine particles indoors along with the fumes.',
  },
  {
    title: 'Swap a wet waste burn for the compost bin.',
    impact: 'Burning garden or kitchen waste releases fine particles right into the neighbourhood air.',
  },
];

// TODO_REAL: replace with real recommendation logic.
export async function getPlan(reading: AqiReading, profile: HouseholdProfile): Promise<Plan> {
  const mood = moodFromAqi(reading.aqi);
  return {
    morning: [...MORNING[mood], ...profileExtras(profile, mood).slice(0, 1)],
    afternoon: [...AFTERNOON[mood], ...profileExtras(profile, mood).slice(1, 2)],
    evening: EVENING[mood],
    indoor: INDOOR,
    swaps: SWAPS,
  };
}
