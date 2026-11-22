import type { Plan, PlanAction, Swap } from './rulePlan';

export function validateAction(action: any): action is PlanAction {
  if (!action || typeof action !== 'object') return false;
  if (typeof action.title !== 'string' || action.title.trim().length === 0) return false;
  if (action.title.length > 90) return false;
  if (typeof action.why !== 'string' || action.why.trim().length === 0) return false;
  if (action.why.length > 160) return false;
  return true;
}

export function validateSwap(swap: any): swap is Swap {
  if (!swap || typeof swap !== 'object') return false;
  if (typeof swap.title !== 'string' || swap.title.trim().length === 0) return false;
  if (swap.title.length > 90) return false;
  if (typeof swap.why !== 'string' || swap.why.trim().length === 0) return false;
  if (swap.why.length > 160) return false;
  if (typeof swap.impact !== 'string' || swap.impact.trim().length === 0) return false;
  if (swap.impact.length > 160) return false;
  return true;
}

export function validatePlanSchema(data: any): Plan | null {
  if (!data || typeof data !== 'object') return null;
  if (typeof data.summary !== 'string' || data.summary.trim().length === 0) return null;

  // morning, afternoon, evening: 2 to 3 actions each
  if (!Array.isArray(data.morning) || data.morning.length < 2 || data.morning.length > 3) return null;
  if (!data.morning.every(validateAction)) return null;

  if (!Array.isArray(data.afternoon) || data.afternoon.length < 2 || data.afternoon.length > 3) return null;
  if (!data.afternoon.every(validateAction)) return null;

  if (!Array.isArray(data.evening) || data.evening.length < 2 || data.evening.length > 3) return null;
  if (!data.evening.every(validateAction)) return null;

  // indoor: exactly 3 actions
  if (!Array.isArray(data.indoor) || data.indoor.length !== 3) return null;
  if (!data.indoor.every(validateAction)) return null;

  // swaps: exactly 3 swaps
  if (!Array.isArray(data.swaps) || data.swaps.length !== 3) return null;
  if (!data.swaps.every(validateSwap)) return null;

  // safetyNote: string or null
  let safetyNote: string | null = null;
  if (data.safetyNote !== null && data.safetyNote !== undefined) {
    if (typeof data.safetyNote !== 'string') return null;
    safetyNote = data.safetyNote;
  }

  return {
    summary: data.summary,
    morning: data.morning,
    afternoon: data.afternoon,
    evening: data.evening,
    indoor: data.indoor,
    swaps: data.swaps,
    safetyNote,
  };
}

export function checkAqiPmHallucinations(
  plan: Plan,
  reading: { aqi: number; pm25: number; pm10: number | null },
): boolean {
  // Collect all text from the plan into an array
  const textSnippets: string[] = [
    plan.summary,
    ...plan.morning.flatMap((a) => [a.title, a.why]),
    ...plan.afternoon.flatMap((a) => [a.title, a.why]),
    ...plan.evening.flatMap((a) => [a.title, a.why]),
    ...plan.indoor.flatMap((a) => [a.title, a.why]),
    ...plan.swaps.flatMap((s) => [s.title, s.why, s.impact]),
    plan.safetyNote || '',
  ];

  const fullText = textSnippets.join(' ');

  // 1. Detect any AQI mentions: e.g. "AQI 150", "AQI of 150", "AQI level of 150", "AQI is 150"
  const aqiRegex = /\b(?:aqi|air quality index)\s*(?:(?:of|is|level|levels|was|around|near|at|value|reading)\s*)*[:=]?\s*(\d+)\b/gi;
  let match: RegExpExecArray | null;

  while ((match = aqiRegex.exec(fullText)) !== null) {
    const val = parseInt(match[1], 10);
    // If mentioned AQI differs from actual reading by more than 1 (allowing rounding), reject
    if (Math.abs(val - reading.aqi) > 1 && Math.abs(val - Math.round(reading.aqi)) > 1) {
      return false;
    }
  }

  // 2. Detect any PM2.5 mentions: e.g. "PM2.5 of 60", "PM2.5 level of 60.5", "PM2.5 is 60.5"
  const pm25Regex = /\bpm\s*2\.?5\s*(?:(?:of|is|level|levels|was|around|near|at|value|reading|concentration)\s*)*[:=]?\s*(\d+(?:\.\d+)?)\b/gi;
  while ((match = pm25Regex.exec(fullText)) !== null) {
    const val = parseFloat(match[1]);
    if (Math.abs(val - reading.pm25) > 1 && Math.abs(val - Math.round(reading.pm25)) > 1) {
      return false;
    }
  }

  // 3. Detect any PM10 mentions: e.g. "PM10 of 120", "PM10 level of 160"
  const pm10Regex = /\bpm\s*10\s*(?:(?:of|is|level|levels|was|around|near|at|value|reading|concentration)\s*)*[:=]?\s*(\d+(?:\.\d+)?)\b/gi;
  while ((match = pm10Regex.exec(fullText)) !== null) {
    const val = parseFloat(match[1]);
    if (reading.pm10 === null) {
      // If PM10 was unavailable, mentioning a specific PM10 concentration is a hallucination
      return false;
    }
    if (Math.abs(val - reading.pm10) > 1 && Math.abs(val - Math.round(reading.pm10)) > 1) {
      return false;
    }
  }

  return true;
}

export function validateAndGuardPlan(
  data: any,
  reading: { aqi: number; pm25: number; pm10: number | null },
): Plan | null {
  const parsed = validatePlanSchema(data);
  if (!parsed) return null;

  const passedGuard = checkAqiPmHallucinations(parsed, reading);
  if (!passedGuard) return null;

  return parsed;
}
