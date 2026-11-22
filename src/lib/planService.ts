import type { AqiReading } from './aqiService';
import { moodFromAqi } from './mood';
import { generateRulePlan, type Plan, type PlanAction, type Swap } from './rulePlan';

export type { Plan, PlanAction, Swap };
export type IndoorTip = PlanAction;

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

export function profileToChips(profile: HouseholdProfile): string[] {
  const chips: string[] = [];
  if (profile.youngChildren) chips.push('youngChildren');
  if (profile.seniorAtHome) chips.push('seniorAtHome');
  if (profile.dailyCommuter) chips.push('dailyCommuter');
  if (profile.studentSports) chips.push('studentSports');
  if (profile.hasPurifier) chips.push('hasPurifier');
  return chips;
}

function getPartOfDay(hour: number): string {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
}

export function getClientPlanCacheKey(
  station: string,
  aqi: number,
  chips: string[],
  localHour: number,
): string {
  const aqiBand = moodFromAqi(aqi);
  const sortedChips = [...chips].sort().join(',');
  const partOfDay = getPartOfDay(localHour);
  return `${(station || 'default').trim().toLowerCase()}::${aqiBand}::${sortedChips}::${partOfDay}`;
}

const CLIENT_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
export const clientPlanCache = new Map<string, { plan: Plan; expiresAt: number }>();

export async function getPlan(
  reading: AqiReading,
  profile: HouseholdProfile,
  signal?: AbortSignal,
): Promise<Plan> {
  const chips = profileToChips(profile);
  const localHour = new Date().getHours();
  const ageMinutes = Math.max(0, Math.floor((Date.now() - reading.timestamp) / 60000));
  const cacheKey = getClientPlanCacheKey(reading.station, reading.aqi, chips, localHour);

  // 1. Check client-side 30-minute cache
  const cached = clientPlanCache.get(cacheKey);
  const now = Date.now();
  if (cached && now < cached.expiresAt) {
    return {
      ...cached.plan,
      cacheHit: true,
    };
  }

  // 2. Call server /api/plan endpoint
  try {
    const res = await fetch('/api/plan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal,
      body: JSON.stringify({
        reading: {
          aqi: reading.aqi,
          pm25: reading.pm25,
          pm10: reading.pm10,
          source: reading.source,
          station: reading.station,
          ageMinutes,
          city: reading.city,
        },
        profile: { chips },
        localHour,
      }),
    });

    if (!res.ok) {
      throw new Error(`Plan API error: ${res.status}`);
    }

    const plan: Plan = await res.json();
    clientPlanCache.set(cacheKey, { plan, expiresAt: now + CLIENT_CACHE_TTL_MS });
    return plan;
  } catch (err: any) {
    if (signal?.aborted) {
      throw err;
    }
    // Fall back to rule-based plan if request fails
    const fallbackPlan = generateRulePlan({
      aqi: reading.aqi,
      chips,
      city: reading.city,
      localHour,
    });
    const finalFallback: Plan = {
      ...fallbackPlan,
      planSource: 'rules',
      cacheHit: false,
    };
    clientPlanCache.set(cacheKey, { plan: finalFallback, expiresAt: now + CLIENT_CACHE_TTL_MS });
    return finalFallback;
  }
}
