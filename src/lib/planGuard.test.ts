import { describe, expect, it } from 'vitest';
import {
  checkAqiPmHallucinations,
  checkInventedNumbers,
  validateAndGuardPlan,
  validatePlanSchema,
} from './planGuard';

// ─── Shared fixture ───────────────────────────────────────────────────────────

const VALID_SAMPLE_PLAN = {
  summary: 'Outdoor air is pleasantly fresh today — a lovely day for open windows.',
  morning: [
    { title: 'You could open the windows for an hour.', why: 'Fresh air naturally airs out the home.' },
    { title: 'A morning stroll in the park is lovely.', why: 'Clear air supports easy breathing.' },
  ],
  afternoon: [
    { title: 'You might spend time in a leafy park.', why: 'Tree-lined spaces offer pleasant shade.' },
    { title: 'Keep windows slightly open if breezy.', why: 'Maintains fresh indoor air exchange.' },
  ],
  evening: [
    { title: 'An evening terrace walk is a calm choice.', why: 'Gentle mobility before dinner.' },
    { title: 'Air out bedrooms before sleeping.', why: 'Cool evening air settles the room.' },
  ],
  indoor: [
    { title: 'Wipe window sills with a damp cloth.', why: 'Lifts settled dust without stirring it.' },
    { title: 'Run kitchen chimney while frying.', why: 'Removes cooking smoke quickly.' },
    { title: 'Keep purifier in living area.', why: 'Cleans occupied room best.' },
  ],
  swaps: [
    {
      title: 'Swap open burning for bagged disposal.',
      why: 'Burning releases dense smoke at ground level.',
      impact: 'No smoke plume added to already hazy air near your home.',
    },
    {
      title: 'Swap dry broom for a damp mop.',
      why: 'Dry sweeping lifts settled dust back into the air.',
      impact: 'Dust stays trapped in the cloth rather than floating back up.',
    },
    {
      title: 'Run the kitchen chimney while cooking.',
      why: 'Cooking fumes are a major short-term indoor particle source.',
      impact: 'Fumes clear faster instead of dispersing through the room.',
    },
  ],
  safetyNote: null,
};

const BASE_READING = { aqi: 45, pm25: 12, pm10: 25, distanceKm: 2.1 };

// ─── validatePlanSchema ───────────────────────────────────────────────────────

describe('planGuard', () => {
  describe('validatePlanSchema', () => {
    it('accepts a good payload matching the schema', () => {
      const result = validatePlanSchema(VALID_SAMPLE_PLAN);
      expect(result).not.toBeNull();
      expect(result?.summary).toBe(VALID_SAMPLE_PLAN.summary);
      expect(result?.morning).toHaveLength(2);
      expect(result?.indoor).toHaveLength(3);
      expect(result?.swaps).toHaveLength(3);
    });

    it('rejects payload with missing summary', () => {
      const bad = { ...VALID_SAMPLE_PLAN, summary: '' };
      expect(validatePlanSchema(bad)).toBeNull();
    });

    it('rejects payload with too few or too many actions in a block', () => {
      const tooFew = { ...VALID_SAMPLE_PLAN, morning: [VALID_SAMPLE_PLAN.morning[0]] };
      expect(validatePlanSchema(tooFew)).toBeNull();

      const tooMany = {
        ...VALID_SAMPLE_PLAN,
        morning: [
          VALID_SAMPLE_PLAN.morning[0],
          VALID_SAMPLE_PLAN.morning[1],
          VALID_SAMPLE_PLAN.morning[0],
          VALID_SAMPLE_PLAN.morning[1],
        ],
      };
      expect(validatePlanSchema(tooMany)).toBeNull();
    });

    it('rejects payload with titles exceeding 90 characters', () => {
      const longTitle = 'a'.repeat(91);
      const bad = {
        ...VALID_SAMPLE_PLAN,
        morning: [
          { title: longTitle, why: 'valid why' },
          VALID_SAMPLE_PLAN.morning[1],
        ],
      };
      expect(validatePlanSchema(bad)).toBeNull();
    });

    it('rejects payload with why exceeding 160 characters', () => {
      const longWhy = 'a'.repeat(161);
      const bad = {
        ...VALID_SAMPLE_PLAN,
        morning: [
          { title: 'Valid Title', why: longWhy },
          VALID_SAMPLE_PLAN.morning[1],
        ],
      };
      expect(validatePlanSchema(bad)).toBeNull();
    });

    it('rejects payload with swaps not having exactly 3 items', () => {
      const badSwaps = {
        ...VALID_SAMPLE_PLAN,
        swaps: [VALID_SAMPLE_PLAN.swaps[0]],
      };
      expect(validatePlanSchema(badSwaps)).toBeNull();
    });
  });

  // ─── checkAqiPmHallucinations ─────────────────────────────────────────────

  describe('checkAqiPmHallucinations', () => {
    const reading = { aqi: 120, pm25: 45.2, pm10: 80 };

    it('passes when text contains no conflicting AQI or PM numbers', () => {
      expect(checkAqiPmHallucinations(VALID_SAMPLE_PLAN, reading)).toBe(true);
    });

    it('passes when text mentions the exact provided AQI number', () => {
      const plan = {
        ...VALID_SAMPLE_PLAN,
        summary: 'With an AQI of 120 today, outdoor air carries some haze.',
      };
      expect(checkAqiPmHallucinations(plan, reading)).toBe(true);
    });

    it('rejects when text mentions a wrong AQI value', () => {
      const plan = {
        ...VALID_SAMPLE_PLAN,
        summary: 'With an AQI of 350 today, stay indoors.',
      };
      expect(checkAqiPmHallucinations(plan, reading)).toBe(false);
    });

    it('rejects when text mentions a wrong PM2.5 value', () => {
      const plan = {
        ...VALID_SAMPLE_PLAN,
        summary: 'PM2.5 is 250 today, which is quite high.',
      };
      expect(checkAqiPmHallucinations(plan, reading)).toBe(false);
    });

    it('rejects when text invents a PM10 value when PM10 was unavailable (null)', () => {
      const noPm10Reading = { aqi: 120, pm25: 45.2, pm10: null };
      const plan = {
        ...VALID_SAMPLE_PLAN,
        summary: 'PM10 level of 160 was observed in your area.',
      };
      expect(checkAqiPmHallucinations(plan, noPm10Reading)).toBe(false);
    });
  });

  // ─── checkInventedNumbers ─────────────────────────────────────────────────

  describe('checkInventedNumbers', () => {
    it('passes a clean plan with only qualitative impact text', () => {
      expect(checkInventedNumbers(VALID_SAMPLE_PLAN, BASE_READING)).toBe(true);
    });

    it('passes when only provided values (AQI, PM2.5, PM10, distance) appear', () => {
      const plan = {
        ...VALID_SAMPLE_PLAN,
        summary: `With an AQI of ${BASE_READING.aqi} today, the air is clear.`,
        swaps: [
          {
            title: 'You could skip the drive today.',
            why: `The station is ${BASE_READING.distanceKm} km away and air is clean.`,
            impact: 'Fewer exhaust particles near your route.',
          },
          ...VALID_SAMPLE_PLAN.swaps.slice(1),
        ],
      };
      expect(checkInventedNumbers(plan, BASE_READING)).toBe(true);
    });

    it('rejects text containing a "%" character', () => {
      const plan = {
        ...VALID_SAMPLE_PLAN,
        swaps: [
          { title: 'Swap X', why: 'Valid why.', impact: 'Reduces exposure by 40%.' },
          VALID_SAMPLE_PLAN.swaps[1],
          VALID_SAMPLE_PLAN.swaps[2],
        ],
      };
      expect(checkInventedNumbers(plan, BASE_READING)).toBe(false);
    });

    it('rejects text containing the word "percent"', () => {
      const plan = {
        ...VALID_SAMPLE_PLAN,
        swaps: [
          { title: 'Swap X', why: 'Valid why.', impact: 'Reduces exposure by forty percent.' },
          VALID_SAMPLE_PLAN.swaps[1],
          VALID_SAMPLE_PLAN.swaps[2],
        ],
      };
      expect(checkInventedNumbers(plan, BASE_READING)).toBe(false);
    });

    it('rejects text containing "per cent" (two words)', () => {
      const plan = {
        ...VALID_SAMPLE_PLAN,
        swaps: [
          { title: 'Swap X', why: 'Valid why.', impact: 'Lower by thirty per cent.' },
          VALID_SAMPLE_PLAN.swaps[1],
          VALID_SAMPLE_PLAN.swaps[2],
        ],
      };
      expect(checkInventedNumbers(plan, BASE_READING)).toBe(false);
    });

    it('rejects text containing "kg" or "kilogram"', () => {
      const plan = {
        ...VALID_SAMPLE_PLAN,
        swaps: [
          { title: 'Swap X', why: 'Valid why.', impact: 'Saves 2 kg of CO2 per trip.' },
          VALID_SAMPLE_PLAN.swaps[1],
          VALID_SAMPLE_PLAN.swaps[2],
        ],
      };
      expect(checkInventedNumbers(plan, BASE_READING)).toBe(false);
    });

    it('rejects text containing "litre" or "liter"', () => {
      const plan = {
        ...VALID_SAMPLE_PLAN,
        swaps: [
          { title: 'Swap X', why: 'Valid why.', impact: 'About half a litre of fuel saved.' },
          VALID_SAMPLE_PLAN.swaps[1],
          VALID_SAMPLE_PLAN.swaps[2],
        ],
      };
      expect(checkInventedNumbers(plan, BASE_READING)).toBe(false);
    });

    it('rejects text containing "times more" or "times less"', () => {
      const plan = {
        ...VALID_SAMPLE_PLAN,
        swaps: [
          { title: 'Swap X', why: 'You breathe times more particles outdoors.', impact: 'Better air inside.' },
          VALID_SAMPLE_PLAN.swaps[1],
          VALID_SAMPLE_PLAN.swaps[2],
        ],
      };
      expect(checkInventedNumbers(plan, BASE_READING)).toBe(false);
    });

    it('rejects text containing "fold" (e.g. "threefold" or "3-fold")', () => {
      const plan = {
        ...VALID_SAMPLE_PLAN,
        swaps: [
          { title: 'Swap X', why: 'Valid why.', impact: 'Threefold lower exposure.' },
          VALID_SAMPLE_PLAN.swaps[1],
          VALID_SAMPLE_PLAN.swaps[2],
        ],
      };
      expect(checkInventedNumbers(plan, BASE_READING)).toBe(false);
    });

    it('rejects an invented standalone number not in the provided reading', () => {
      // 500 is not in the reading (aqi=45, pm25=12, pm10=25, dist=2.1)
      const plan = {
        ...VALID_SAMPLE_PLAN,
        swaps: [
          { title: 'Swap X', why: 'Valid why.', impact: 'You avoid 500 extra particles.' },
          VALID_SAMPLE_PLAN.swaps[1],
          VALID_SAMPLE_PLAN.swaps[2],
        ],
      };
      expect(checkInventedNumbers(plan, BASE_READING)).toBe(false);
    });
  });

  // ─── validateAndGuardPlan ─────────────────────────────────────────────────

  describe('validateAndGuardPlan', () => {
    it('returns the validated plan if both schema and guard pass', () => {
      const result = validateAndGuardPlan(VALID_SAMPLE_PLAN, BASE_READING);
      expect(result).not.toBeNull();
    });

    it('returns null if schema fails', () => {
      expect(validateAndGuardPlan(null, BASE_READING)).toBeNull();
    });

    it('returns null if AQI hallucination check fails', () => {
      const hallucinated = {
        ...VALID_SAMPLE_PLAN,
        summary: 'AQI of 480 reported today.',
      };
      expect(validateAndGuardPlan(hallucinated, BASE_READING)).toBeNull();
    });

    it('returns null if invented-number check fails (percentage in impact)', () => {
      const withPercent = {
        ...VALID_SAMPLE_PLAN,
        swaps: [
          { title: 'Swap X', why: 'Valid.', impact: 'Saves 30% exposure.' },
          VALID_SAMPLE_PLAN.swaps[1],
          VALID_SAMPLE_PLAN.swaps[2],
        ],
      };
      expect(validateAndGuardPlan(withPercent, BASE_READING)).toBeNull();
    });
  });
});
