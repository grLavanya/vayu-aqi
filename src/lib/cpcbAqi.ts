/**
 * CPCB Indian National Air Quality Index (NAQI) calculation for PM2.5 and PM10.
 *
 * NOTE: This uses the latest reading, not a 24-hour average, and the UI labels it
 * "estimated from the latest PM2.5/PM10 reading".
 */

export interface AqiBreakpoint {
  cLo: number;
  cHi: number;
  iLo: number;
  iHi: number;
}

export const PM25_BREAKPOINTS: readonly AqiBreakpoint[] = [
  { cLo: 0, cHi: 30, iLo: 0, iHi: 50 },
  { cLo: 31, cHi: 60, iLo: 51, iHi: 100 },
  { cLo: 61, cHi: 90, iLo: 101, iHi: 200 },
  { cLo: 91, cHi: 120, iLo: 201, iHi: 300 },
  { cLo: 121, cHi: 250, iLo: 301, iHi: 400 },
  { cLo: 251, cHi: 380, iLo: 401, iHi: 500 }, // 250+ (up to 380, capped at 500)
];

export const PM10_BREAKPOINTS: readonly AqiBreakpoint[] = [
  { cLo: 0, cHi: 50, iLo: 0, iHi: 50 },
  { cLo: 51, cHi: 100, iLo: 51, iHi: 100 },
  { cLo: 101, cHi: 250, iLo: 101, iHi: 200 },
  { cLo: 251, cHi: 350, iLo: 201, iHi: 300 },
  { cLo: 351, cHi: 430, iLo: 301, iHi: 400 },
  { cLo: 431, cHi: 500, iLo: 401, iHi: 500 }, // 430+ (up to 500, capped at 500)
];

export function calculateSubIndex(
  concentration: number,
  breakpoints: readonly AqiBreakpoint[],
): number {
  if (concentration < 0 || isNaN(concentration)) return 0;

  // Round concentration to nearest integer as per standard CPCB method,
  // while ensuring boundary values fall precisely into the designated band.
  const c = Math.round(concentration);

  for (let i = 0; i < breakpoints.length; i++) {
    const bp = breakpoints[i];
    if (c <= bp.cHi || i === breakpoints.length - 1) {
      if (c >= bp.cHi && i === breakpoints.length - 1) {
        return bp.iHi; // Capped at 500
      }
      const clampedC = Math.max(bp.cLo, Math.min(bp.cHi, c));
      const subIndex =
        ((bp.iHi - bp.iLo) / (bp.cHi - bp.cLo)) * (clampedC - bp.cLo) + bp.iLo;
      return Math.round(subIndex);
    }
  }

  return 500;
}

export function calculatePm25SubIndex(pm25: number): number {
  return calculateSubIndex(pm25, PM25_BREAKPOINTS);
}

export function calculatePm10SubIndex(pm10: number): number {
  return calculateSubIndex(pm10, PM10_BREAKPOINTS);
}

export interface PollutantValues {
  pm25?: number | null;
  pm10?: number | null;
}

export function calculateCpcbAqi(values: PollutantValues): number | null {
  const pm25Valid = typeof values.pm25 === 'number' && !isNaN(values.pm25);
  const pm10Valid = typeof values.pm10 === 'number' && !isNaN(values.pm10);

  if (!pm25Valid && !pm10Valid) {
    return null;
  }

  const subIndices: number[] = [];
  if (pm25Valid) {
    subIndices.push(calculatePm25SubIndex(values.pm25!));
  }
  if (pm10Valid) {
    subIndices.push(calculatePm10SubIndex(values.pm10!));
  }

  return Math.max(...subIndices);
}
