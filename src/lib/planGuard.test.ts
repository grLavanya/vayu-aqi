import { describe, expect, it } from 'vitest';
import {
  checkAqiPmHallucinations,
  validateAndGuardPlan,
  validatePlanSchema,
} from './planGuard';

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
    { title: 'Swap short drive for walk.', why: 'Reduces neighborhood emissions.', impact: 'Roughly 1 km of exhaust saved.' },
    { title: 'Swap idle for switch off.', why: 'Prevents stationary exhaust.', impact: 'About half a litre fuel saved.' },
    { title: 'Swap spray for cloth wipe.', why: 'Avoids aerosol propellants.', impact: 'Lower indoor chemical particles.' },
  ],
  safetyNote: null,
};

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

  describe('checkAqiPmHallucinations', () => {
    const reading = { aqi: 120, pm25: 45.2, pm10: 80 };

    it('passes when text contains no conflicting AQI or PM numbers', () => {
      const plan = { ...VALID_SAMPLE_PLAN };
      expect(checkAqiPmHallucinations(plan, reading)).toBe(true);
    });

    it('passes when text mentions the exact provided AQI number', () => {
      const plan = {
        ...VALID_SAMPLE_PLAN,
        summary: 'With an AQI of 120 today, outdoor air carries moderate dust.',
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

  describe('validateAndGuardPlan', () => {
    it('returns the validated plan if both schema and guard pass', () => {
      const result = validateAndGuardPlan(VALID_SAMPLE_PLAN, { aqi: 45, pm25: 12, pm10: 25 });
      expect(result).not.toBeNull();
    });

    it('returns null if schema fails or guard fails', () => {
      expect(validateAndGuardPlan(null, { aqi: 45, pm25: 12, pm10: 25 })).toBeNull();
      const hallucinated = {
        ...VALID_SAMPLE_PLAN,
        summary: 'AQI of 480 reported today.',
      };
      expect(validateAndGuardPlan(hallucinated, { aqi: 45, pm25: 12, pm10: 25 })).toBeNull();
    });
  });
});
