import type { VercelRequest, VercelResponse } from '@vercel/node';
import { moodFromAqi } from '../src/lib/mood';
import { generateRulePlan, type Plan } from '../src/lib/rulePlan';
import { validateAndGuardPlan } from '../src/lib/planGuard';
import {
  PLAN_RESPONSE_SCHEMA,
  PLAN_SYSTEM_PROMPT,
  buildPlanUserPrompt,
} from '../src/prompts/planPrompt';

const VALID_CHIPS = new Set([
  'youngChildren',
  'seniorAtHome',
  'dailyCommuter',
  'studentSports',
  'hasPurifier',
]);

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
export const serverPlanCache = new Map<string, { plan: Plan; expiresAt: number }>();

function getPartOfDay(hour: number): string {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
}

export function getPlanCacheKey(
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  // 1. Strict Input Validation
  const body = req.body;
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Invalid body: JSON object expected.' });
  }

  const { reading, profile, localHour } = body;
  if (!reading || typeof reading !== 'object' || !profile || typeof profile !== 'object') {
    return res.status(400).json({ error: 'Invalid body structure: reading and profile required.' });
  }

  // Sane numerical & text limits
  const aqi = reading.aqi;
  const pm25 = reading.pm25;
  const pm10 = reading.pm10;
  const city = reading.city;
  const source = reading.source;
  const station = reading.station;
  const ageMinutes = reading.ageMinutes;

  if (typeof aqi !== 'number' || isNaN(aqi) || aqi < 0 || aqi > 500) {
    return res.status(400).json({ error: 'Invalid AQI: must be between 0 and 500.' });
  }

  if (typeof pm25 !== 'number' || isNaN(pm25) || pm25 < 0 || pm25 > 1000) {
    return res.status(400).json({ error: 'Invalid PM2.5: must be between 0 and 1000.' });
  }

  if (pm10 !== null && (typeof pm10 !== 'number' || isNaN(pm10) || pm10 < 0 || pm10 > 1500)) {
    return res.status(400).json({ error: 'Invalid PM10: must be null or between 0 and 1500.' });
  }

  if (typeof city !== 'string' || city.length > 80) {
    return res.status(400).json({ error: 'Invalid city: max 80 characters.' });
  }

  if (typeof source !== 'string' || source.length > 100) {
    return res.status(400).json({ error: 'Invalid source string.' });
  }

  if (typeof station !== 'string' || station.length > 120) {
    return res.status(400).json({ error: 'Invalid station string.' });
  }

  if (typeof ageMinutes !== 'number' || isNaN(ageMinutes) || ageMinutes < 0) {
    return res.status(400).json({ error: 'Invalid ageMinutes: must be non-negative number.' });
  }

  // Profile chips validation
  if (!Array.isArray(profile.chips)) {
    return res.status(400).json({ error: 'Invalid profile.chips: array required.' });
  }

  const chips: string[] = profile.chips;
  for (const chip of chips) {
    if (typeof chip !== 'string' || !VALID_CHIPS.has(chip)) {
      return res.status(400).json({ error: `Unknown profile chip: ${chip}` });
    }
  }

  // Local hour validation
  if (typeof localHour !== 'number' || !Number.isInteger(localHour) || localHour < 0 || localHour > 23) {
    return res.status(400).json({ error: 'Invalid localHour: integer between 0 and 23 required.' });
  }

  // 2. Cache Lookup
  const cacheKey = getPlanCacheKey(station, aqi, chips, localHour);
  const now = Date.now();
  const cached = serverPlanCache.get(cacheKey);

  if (cached && now < cached.expiresAt) {
    return res.status(200).json({
      ...cached.plan,
      cacheHit: true,
    });
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const model = process.env.GEMINI_MODEL?.trim() || 'gemini-3.1-flash-lite';

  // 3. If no GEMINI_API_KEY is configured, gracefully fall back to rule-based plan
  if (!apiKey) {
    const fallbackPlan = generateRulePlan({ aqi, chips, city, localHour });
    const responsePlan: Plan = {
      ...fallbackPlan,
      planSource: 'rules',
      model,
      cacheHit: false,
    };
    serverPlanCache.set(cacheKey, { plan: responsePlan, expiresAt: now + CACHE_TTL_MS });
    return res.status(200).json(responsePlan);
  }

  // 4. Gemini Call with 15-second timeout & structured output
  try {
    const userPrompt = buildPlanUserPrompt({
      reading: { aqi, pm25, pm10, source, station, ageMinutes, city },
      profile: { chips },
      localHour,
    });

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: PLAN_SYSTEM_PROMPT }],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: userPrompt }],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
          responseSchema: PLAN_RESPONSE_SCHEMA,
        },
      }),
    });

    clearTimeout(timeoutId);

    if (!geminiRes.ok) {
      console.warn(`[api/plan] Gemini API returned status ${geminiRes.status}: ${await geminiRes.text()}`);
      throw new Error(`Gemini status ${geminiRes.status}`);
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new Error('Empty response from Gemini');
    }

    const parsed = JSON.parse(rawText);

    // 5. Guard: Schema validation and numeric hallucination check
    const guardedPlan = validateAndGuardPlan(parsed, { aqi, pm25, pm10 });
    if (!guardedPlan) {
      console.warn('[api/plan] Plan failed guard validation (schema or AQI/PM mismatch). Falling back to rules.');
      throw new Error('Guard validation failed');
    }

    const finalPlan: Plan = {
      ...guardedPlan,
      planSource: 'gemini',
      model,
      cacheHit: false,
    };

    serverPlanCache.set(cacheKey, { plan: finalPlan, expiresAt: now + CACHE_TTL_MS });
    return res.status(200).json(finalPlan);
  } catch (err: any) {
    console.warn(`[api/plan] Gemini generation error (${err.message || 'unknown'}). Serving rule-based fallback.`);
    const fallbackPlan = generateRulePlan({ aqi, chips, city, localHour });
    const responsePlan: Plan = {
      ...fallbackPlan,
      planSource: 'rules',
      model,
      cacheHit: false,
    };
    serverPlanCache.set(cacheKey, { plan: responsePlan, expiresAt: now + CACHE_TTL_MS });
    return res.status(200).json(responsePlan);
  }
}
