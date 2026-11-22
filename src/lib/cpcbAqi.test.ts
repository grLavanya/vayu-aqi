import { describe, expect, it } from 'vitest';
import {
  calculateCpcbAqi,
  calculatePm10SubIndex,
  calculatePm25SubIndex,
} from './cpcbAqi';

describe('CPCB AQI Calculation', () => {
  describe('PM2.5 band boundaries', () => {
    it('calculates Band 1 (0-30 -> 0-50)', () => {
      expect(calculatePm25SubIndex(0)).toBe(0);
      expect(calculatePm25SubIndex(15)).toBe(25);
      expect(calculatePm25SubIndex(30)).toBe(50);
    });

    it('calculates Band 2 (31-60 -> 51-100)', () => {
      expect(calculatePm25SubIndex(31)).toBe(51);
      expect(calculatePm25SubIndex(60)).toBe(100);
    });

    it('calculates Band 3 (61-90 -> 101-200)', () => {
      expect(calculatePm25SubIndex(61)).toBe(101);
      expect(calculatePm25SubIndex(90)).toBe(200);
    });

    it('calculates Band 4 (91-120 -> 201-300)', () => {
      expect(calculatePm25SubIndex(91)).toBe(201);
      expect(calculatePm25SubIndex(120)).toBe(300);
    });

    it('calculates Band 5 (121-250 -> 301-400)', () => {
      expect(calculatePm25SubIndex(121)).toBe(301);
      expect(calculatePm25SubIndex(250)).toBe(400);
    });

    it('calculates Band 6 (250+ -> 401-500)', () => {
      expect(calculatePm25SubIndex(251)).toBe(401);
      expect(calculatePm25SubIndex(380)).toBe(500);
      expect(calculatePm25SubIndex(450)).toBe(500);
    });
  });

  describe('PM10 band boundaries', () => {
    it('calculates Band 1 (0-50 -> 0-50)', () => {
      expect(calculatePm10SubIndex(0)).toBe(0);
      expect(calculatePm10SubIndex(25)).toBe(25);
      expect(calculatePm10SubIndex(50)).toBe(50);
    });

    it('calculates Band 2 (51-100 -> 51-100)', () => {
      expect(calculatePm10SubIndex(51)).toBe(51);
      expect(calculatePm10SubIndex(100)).toBe(100);
    });

    it('calculates Band 3 (101-250 -> 101-200)', () => {
      expect(calculatePm10SubIndex(101)).toBe(101);
      expect(calculatePm10SubIndex(250)).toBe(200);
    });

    it('calculates Band 4 (251-350 -> 201-300)', () => {
      expect(calculatePm10SubIndex(251)).toBe(201);
      expect(calculatePm10SubIndex(350)).toBe(300);
    });

    it('calculates Band 5 (351-430 -> 301-400)', () => {
      expect(calculatePm10SubIndex(351)).toBe(301);
      expect(calculatePm10SubIndex(430)).toBe(400);
    });

    it('calculates Band 6 (430+ -> 401-500)', () => {
      expect(calculatePm10SubIndex(431)).toBe(401);
      expect(calculatePm10SubIndex(500)).toBe(500);
      expect(calculatePm10SubIndex(600)).toBe(500);
    });
  });

  describe('Maximum sub-index calculation', () => {
    it('takes the maximum of PM2.5 and PM10', () => {
      // PM2.5=90 -> 200, PM10=50 -> 50 => max is 200
      expect(calculateCpcbAqi({ pm25: 90, pm10: 50 })).toBe(200);

      // PM2.5=30 -> 50, PM10=250 -> 200 => max is 200
      expect(calculateCpcbAqi({ pm25: 30, pm10: 250 })).toBe(200);
    });

    it('handles single pollutant values', () => {
      expect(calculateCpcbAqi({ pm25: 60 })).toBe(100);
      expect(calculateCpcbAqi({ pm10: 100 })).toBe(100);
    });

    it('returns null if neither pollutant is available', () => {
      expect(calculateCpcbAqi({})).toBeNull();
      expect(calculateCpcbAqi({ pm25: null, pm10: null })).toBeNull();
    });
  });
});
