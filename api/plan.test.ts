import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler, { serverPlanCache } from './plan';

describe('API /api/plan handler', () => {
  const originalFetch = globalThis.fetch;
  const originalGeminiKey = process.env.GEMINI_API_KEY;
  const originalGeminiModel = process.env.GEMINI_MODEL;

  beforeEach(() => {
    serverPlanCache.clear();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalGeminiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = originalGeminiKey;
    }
    if (originalGeminiModel === undefined) {
      delete process.env.GEMINI_MODEL;
    } else {
      process.env.GEMINI_MODEL = originalGeminiModel;
    }
    vi.restoreAllMocks();
  });

  function createMockReqRes(method: string, body: any) {
    let statusCode = 200;
    let jsonBody: any = null;

    const req: any = { method, body };
    const res: any = {
      status(code: number) {
        statusCode = code;
        return res;
      },
      json(data: any) {
        jsonBody = data;
        return res;
      },
    };

    return {
      req,
      res,
      getStatus: () => statusCode,
      getBody: () => jsonBody,
    };
  }

  const baseReading = {
    aqi: 180,
    pm25: 75.0,
    pm10: 120.0,
    city: 'Delhi',
    source: 'OpenAQ',
    station: 'Mandir Marg',
    ageMinutes: 30,
  };

  const baseProfile = {
    chips: ['youngChildren'],
  };

  it('rejects non-POST methods with 405', async () => {
    const { req, res, getStatus, getBody } = createMockReqRes('GET', {});
    await handler(req, res);
    expect(getStatus()).toBe(405);
    expect(getBody().error).toMatch(/Method not allowed/);
  });

  it('rejects missing or non-object body with 400', async () => {
    const { req, res, getStatus, getBody } = createMockReqRes('POST', null);
    await handler(req, res);
    expect(getStatus()).toBe(400);
    expect(getBody().error).toMatch(/Invalid body/);
  });

  it('rejects missing reading or profile with 400', async () => {
    const { req, res, getStatus } = createMockReqRes('POST', {
      reading: null,
      profile: baseProfile,
      localHour: 10,
    });
    await handler(req, res);
    expect(getStatus()).toBe(400);
  });

  it('rejects out-of-range AQI (> 500 or < 0) with 400', async () => {
    const { req, res, getStatus, getBody } = createMockReqRes('POST', {
      reading: { ...baseReading, aqi: 501 },
      profile: baseProfile,
      localHour: 10,
    });
    await handler(req, res);
    expect(getStatus()).toBe(400);
    expect(getBody().error).toMatch(/Invalid AQI/);
  });

  it('rejects out-of-range PM2.5 with 400', async () => {
    const { req, res, getStatus, getBody } = createMockReqRes('POST', {
      reading: { ...baseReading, pm25: -5 },
      profile: baseProfile,
      localHour: 10,
    });
    await handler(req, res);
    expect(getStatus()).toBe(400);
    expect(getBody().error).toMatch(/Invalid PM2.5/);
  });

  it('allows null PM10 but rejects invalid PM10 with 400', async () => {
    // Valid null PM10
    const mockPlan = {
      summary: 'A calm day.',
      morning: [
        { title: 'You could walk', why: 'Air is moderate.' },
        { title: 'Open windows', why: 'Gentle breeze.' },
      ],
      afternoon: [
        { title: 'Keep windows closed', why: 'Dust levels peak.' },
        { title: 'Rest indoors', why: 'Calm space.' },
      ],
      evening: [
        { title: 'Enjoy the park', why: 'Levels settle.' },
        { title: 'Air out rooms', why: 'Night air cools.' },
      ],
      indoor: [
        { title: 'Keep windows ajar', why: 'Air is fresh.' },
        { title: 'Wipe surfaces', why: 'Less dust.' },
        { title: 'Run purifier', why: 'Cleaner air.' },
      ],
      swaps: [
        { title: 'A lighter choice', why: 'Saves exposure.', impact: 'About 20% less' },
        { title: 'Metro over car', why: 'Avoids traffic.', impact: 'About 15% less' },
        { title: 'Indoor gym', why: 'Cleaner air.', impact: 'Roughly 30% less' },
      ],
      safetyNote: null,
    };

    process.env.GEMINI_API_KEY = 'test_key';
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          candidates: [{ content: { parts: [{ text: JSON.stringify(mockPlan) }] } }],
        }),
    });

    const { req: req1, res: res1, getStatus: getStatus1 } = createMockReqRes('POST', {
      reading: { ...baseReading, pm10: null },
      profile: baseProfile,
      localHour: 10,
    });
    await handler(req1, res1);
    expect(getStatus1()).toBe(200);

    // Invalid PM10 (e.g. negative or > 1500)
    const { req: req2, res: res2, getStatus: getStatus2, getBody: getBody2 } = createMockReqRes('POST', {
      reading: { ...baseReading, pm10: 2000 },
      profile: baseProfile,
      localHour: 10,
    });
    await handler(req2, res2);
    expect(getStatus2()).toBe(400);
    expect(getBody2().error).toMatch(/Invalid PM10/);
  });

  it('rejects unknown profile chips with 400', async () => {
    const { req, res, getStatus, getBody } = createMockReqRes('POST', {
      reading: baseReading,
      profile: { chips: ['unknownChip123'] },
      localHour: 10,
    });
    await handler(req, res);
    expect(getStatus()).toBe(400);
    expect(getBody().error).toMatch(/Unknown profile chip/);
  });

  it('rejects city name exceeding 80 characters with 400', async () => {
    const { req, res, getStatus, getBody } = createMockReqRes('POST', {
      reading: { ...baseReading, city: 'A'.repeat(81) },
      profile: baseProfile,
      localHour: 10,
    });
    await handler(req, res);
    expect(getStatus()).toBe(400);
    expect(getBody().error).toMatch(/Invalid city/);
  });

  it('rejects invalid localHour with 400', async () => {
    const { req, res, getStatus, getBody } = createMockReqRes('POST', {
      reading: baseReading,
      profile: baseProfile,
      localHour: 25,
    });
    await handler(req, res);
    expect(getStatus()).toBe(400);
    expect(getBody().error).toMatch(/Invalid localHour/);
  });

  it('falls back to rule-based plan when GEMINI_API_KEY is missing', async () => {
    delete process.env.GEMINI_API_KEY;

    const { req, res, getStatus, getBody } = createMockReqRes('POST', {
      reading: baseReading,
      profile: baseProfile,
      localHour: 8,
    });

    await handler(req, res);
    expect(getStatus()).toBe(200);
    const body = getBody();
    expect(body.planSource).toBe('rules');
    expect(body.cacheHit).toBe(false);
    expect(body.morning.length).toBeGreaterThan(0);
  });

  it('caches Gemini plan and returns cacheHit: true on second request without invoking fetch again', async () => {
    process.env.GEMINI_API_KEY = 'test_key';
    const mockPlan = {
      summary: 'Air is heavy today in Delhi.',
      morning: [
        { title: 'You could delay morning runs', why: 'Air quality index is 180.' },
        { title: 'Keep windows closed', why: 'Prevents outdoor particles coming inside.' },
      ],
      afternoon: [
        { title: 'A lighter choice indoors', why: 'Particles linger in heavy outdoor air.' },
        { title: 'Stay hydrated', why: 'Keeps airways moist and comfortable.' },
      ],
      evening: [
        { title: 'Consider indoor board games', why: 'Evening traffic adds fresh particles to the air.' },
        { title: 'Air purifier in bedroom', why: 'Circulates clean air before bedtime.' },
      ],
      indoor: [
        { title: 'Keep doors sealed', why: 'Reduces draft carrying outdoor particles inside.' },
        { title: 'Wet mop floors', why: 'Gathers settled dust instead of lifting it.' },
        { title: 'Run air cleaner', why: 'Filters fine particles from room air.' },
      ],
      swaps: [
        {
          title: 'Metro instead of auto rickshaw',
          why: 'Enclosed cabin keeps you away from direct roadside exhaust.',
          impact: 'Fewer exhaust particles in your breathing zone during the ride.',
        },
        {
          title: 'Indoor yoga instead of outdoor run',
          why: 'Deep breathing outdoors in heavy air draws in more particles.',
          impact: 'Activity continues with noticeably less particle intake.',
        },
        {
          title: 'Damp mop instead of dry broom',
          why: 'Dry sweeping resuspends settled dust back into the breathing zone.',
          impact: 'Dust stays trapped in the cloth rather than floating back up.',
        },
      ],
      safetyNote: null,
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          candidates: [{ content: { parts: [{ text: JSON.stringify(mockPlan) }] } }],
        }),
    });
    globalThis.fetch = fetchMock;

    const requestPayload = {
      reading: baseReading,
      profile: { chips: ['youngChildren'] },
      localHour: 8, // morning
    };

    // First request - should call Gemini
    const { req: req1, res: res1, getStatus: getStatus1, getBody: getBody1 } = createMockReqRes('POST', requestPayload);
    await handler(req1, res1);

    expect(getStatus1()).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getBody1().planSource).toBe('gemini');
    expect(getBody1().cacheHit).toBe(false);

    // Second request with same station + band + chips + partOfDay - should hit cache
    const { req: req2, res: res2, getStatus: getStatus2, getBody2 = getBody1 } = createMockReqRes('POST', requestPayload);
    await handler(req2, res2);

    expect(fetchMock).toHaveBeenCalledTimes(1); // Not called again!
    const body2 = res2.json.mock ? res2.json.mock.calls[0][0] : undefined;
    // Inspect via getBody
    const cachedBody = createMockReqRes('POST', requestPayload);
    await handler(cachedBody.req, cachedBody.res);
    expect(cachedBody.getBody().cacheHit).toBe(true);
    expect(cachedBody.getBody().summary).toBe(mockPlan.summary);
  });

  it('falls back to rulePlan when Gemini returns an error or non-200 status', async () => {
    process.env.GEMINI_API_KEY = 'test_key';
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: () => Promise.resolve('Service Unavailable'),
    });

    const { req, res, getStatus, getBody } = createMockReqRes('POST', {
      reading: baseReading,
      profile: baseProfile,
      localHour: 14,
    });

    await handler(req, res);
    expect(getStatus()).toBe(200);
    expect(getBody().planSource).toBe('rules');
  });

  it('falls back to rulePlan when Gemini output fails guard (hallucinated AQI)', async () => {
    process.env.GEMINI_API_KEY = 'test_key';
    const hallucinatedPlan = {
      summary: 'Air is very dense today with AQI 450.', // Hallucinated AQI 450 instead of provided 180!
      morning: [{ title: 'You could stay indoors', why: 'AQI is 450.' }],
      afternoon: [{ title: 'Rest quietly', why: 'Very bad air.' }],
      evening: [{ title: 'Keep windows shut', why: 'Dense outside.' }],
      indoor: [
        { title: 'Air purifier', why: 'Cleans air.' },
        { title: 'Wet mop', why: 'Traps dust.' },
        { title: 'Close windows', why: 'Seals home.' },
      ],
      swaps: [
        { title: 'Swap 1', why: 'Why 1', impact: 'About 10%' },
        { title: 'Swap 2', why: 'Why 2', impact: 'About 20%' },
        { title: 'Swap 3', why: 'Why 3', impact: 'About 30%' },
      ],
      safetyNote: null,
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          candidates: [{ content: { parts: [{ text: JSON.stringify(hallucinatedPlan) }] } }],
        }),
    });

    const { req, res, getStatus, getBody } = createMockReqRes('POST', {
      reading: baseReading,
      profile: baseProfile,
      localHour: 10,
    });

    await handler(req, res);
    expect(getStatus()).toBe(200);
    // Since guard rejects it, fallback to rules
    expect(getBody().planSource).toBe('rules');
  });
});
