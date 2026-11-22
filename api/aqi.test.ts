import { afterEach, describe, expect, it, vi } from 'vitest';
import handler from './aqi';

describe('API /api/aqi handler', () => {
  const originalFetch = globalThis.fetch;
  const originalEnvKey = process.env.OPENAQ_API_KEY;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalEnvKey === undefined) {
      delete process.env.OPENAQ_API_KEY;
    } else {
      process.env.OPENAQ_API_KEY = originalEnvKey;
    }
    vi.restoreAllMocks();
  });

  it('returns 400 for out-of-bounds coordinates', async () => {
    let statusCode: number | null = null;
    let jsonBody: any = null;

    const req: any = {
      query: { lat: '0', lon: '0' },
    };
    const res: any = {
      setHeader: () => {},
      status: (code: number) => {
        statusCode = code;
        return res;
      },
      json: (data: any) => {
        jsonBody = data;
        return res;
      },
    };

    await handler(req, res);
    expect(statusCode).toBe(400);
    expect(jsonBody.error).toBeDefined();
  });

  it('returns 400 for non-numeric coordinates', async () => {
    let statusCode: number | null = null;
    const req: any = {
      query: { lat: 'abc', lon: 'xyz' },
    };
    const res: any = {
      setHeader: () => {},
      status: (code: number) => {
        statusCode = code;
        return res;
      },
      json: () => res,
    };

    await handler(req, res);
    expect(statusCode).toBe(400);
  });

  it('falls back to Open-Meteo with "key missing" and keyPresent: false when OPENAQ_API_KEY is unset', async () => {
    delete process.env.OPENAQ_API_KEY;
    let statusCode: number | null = null;
    let jsonBody: any = null;
    const headers: Record<string, string> = {};

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('open-meteo.com')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              current: {
                time: '2026-11-21T17:30',
                pm2_5: 75.4,
                pm10: 120.0,
              },
            }),
        });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });

    const req: any = {
      query: { lat: '28.6139', lon: '77.2090', city: 'Delhi' },
    };
    const res: any = {
      setHeader: (k: string, v: string) => {
        headers[k] = v;
      },
      status: (code: number) => {
        statusCode = code;
        return res;
      },
      json: (data: any) => {
        jsonBody = data;
        return res;
      },
    };

    await handler(req, res);

    expect(statusCode).toBe(200);
    expect(headers['Cache-Control']).toBe(
      's-maxage=600, stale-while-revalidate=300',
    );
    expect(jsonBody.source).toBe('Modelled estimate (CAMS via Open-Meteo)');
    expect(jsonBody.fallbackReason).toBe('key missing');
    expect(jsonBody.keyPresent).toBe(false);
  });

  it('reports "HTTP status from OpenAQ" when OpenAQ returns non-200 and falls back to Open-Meteo', async () => {
    process.env.OPENAQ_API_KEY = 'test_key';
    let jsonBody: any = null;

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('openaq.org')) {
        return Promise.resolve({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
        });
      }
      if (url.includes('open-meteo.com')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              current: { time: '2026-11-21T17:30', pm2_5: 50.0, pm10: 90.0 },
            }),
        });
      }
      return Promise.resolve({ ok: false, status: 500 });
    });

    const req: any = { query: { lat: '28.6139', lon: '77.2090' } };
    const res: any = {
      setHeader: () => {},
      status: () => res,
      json: (data: any) => {
        jsonBody = data;
        return res;
      },
    };

    await handler(req, res);
    expect(jsonBody.source).toBe('Modelled estimate (CAMS via Open-Meteo)');
    expect(jsonBody.fallbackReason).toBe('HTTP status 401 from OpenAQ');
    expect(jsonBody.keyPresent).toBe(true);
  });

  it('reports "zero stations found within 25 km" when OpenAQ returns empty list and falls back to Open-Meteo', async () => {
    process.env.OPENAQ_API_KEY = 'test_key';
    let jsonBody: any = null;

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('openaq.org')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ results: [] }),
        });
      }
      if (url.includes('open-meteo.com')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              current: { time: '2026-11-21T17:30', pm2_5: 35.0, pm10: 60.0 },
            }),
        });
      }
      return Promise.resolve({ ok: false, status: 500 });
    });

    const req: any = { query: { lat: '28.6139', lon: '77.2090' } };
    const res: any = {
      setHeader: () => {},
      status: () => res,
      json: (data: any) => {
        jsonBody = data;
        return res;
      },
    };

    await handler(req, res);
    expect(jsonBody.source).toBe('Modelled estimate (CAMS via Open-Meteo)');
    expect(jsonBody.fallbackReason).toBe('zero stations found within 25 km');
    expect(jsonBody.keyPresent).toBe(true);
  });

  it('drops stale stations before calling /latest and selects the nearest fresh station', async () => {
    process.env.OPENAQ_API_KEY = 'test_key';
    const calledLatestUrls: string[] = [];
    let jsonBody: any = null;

    const now = Date.now();
    // Station 1: closest (1.1 km), but datetimeLast is 8 years old (~70000h)
    const st1Time = new Date(now - 70000 * 3600 * 1000).toISOString();
    // Station 2: next (2.5 km), datetimeLast is fresh (1h ago), but sensor measurement in /latest is stale (5h ago)
    const st2LocTime = new Date(now - 1 * 3600 * 1000).toISOString();
    const st2MeasTime = new Date(now - 5 * 3600 * 1000).toISOString();
    // Station 3: next (4.2 km), datetimeLast is fresh (45m ago), and sensor measurement is fresh (45m ago)
    const st3Time = new Date(now - 45 * 60 * 1000).toISOString();
    // Station 4: further (12 km), also fresh
    const st4Time = new Date(now - 10 * 60 * 1000).toISOString();

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/v3/locations?')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              results: [
                {
                  id: 101,
                  name: 'Defunct Station 101',
                  coordinates: { latitude: 28.62, longitude: 77.21 }, // ~1 km
                  datetimeLast: { utc: st1Time },
                  sensors: [{ id: 1, name: 'pm25', parameter: { name: 'pm25' } }],
                },
                {
                  id: 102,
                  name: 'Stale Sensor Station 102',
                  coordinates: { latitude: 28.63, longitude: 77.22 }, // ~2.5 km
                  datetimeLast: { utc: st2LocTime },
                  sensors: [{ id: 2, name: 'pm25', parameter: { name: 'pm25' } }],
                },
                {
                  id: 103,
                  name: 'Fresh Station 103',
                  coordinates: { latitude: 28.64, longitude: 77.23 }, // ~4.2 km
                  datetimeLast: { utc: st3Time },
                  sensors: [
                    { id: 3, name: 'pm25', parameter: { name: 'pm25' } },
                    { id: 4, name: 'pm10', parameter: { name: 'pm10' } },
                  ],
                },
                {
                  id: 104,
                  name: 'Far Fresh Station 104',
                  coordinates: { latitude: 28.70, longitude: 77.30 }, // ~12 km
                  datetimeLast: { utc: st4Time },
                  sensors: [{ id: 5, name: 'pm25', parameter: { name: 'pm25' } }],
                },
              ],
            }),
        });
      }

      if (url.includes('/latest')) {
        calledLatestUrls.push(url);

        if (url.includes('/102/latest')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                results: [
                  {
                    sensorsId: 2,
                    value: 120,
                    datetime: { utc: st2MeasTime },
                  },
                ],
              }),
          });
        }

        if (url.includes('/103/latest')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                results: [
                  {
                    sensorsId: 3,
                    value: 84.5,
                    datetime: { utc: st3Time },
                  },
                  {
                    sensorsId: 4,
                    value: 142.0,
                    datetime: { utc: st3Time },
                  },
                ],
              }),
          });
        }
      }

      return Promise.resolve({ ok: false, status: 500 });
    });

    const req: any = { query: { lat: '28.6139', lon: '77.2090' } };
    const res: any = {
      setHeader: () => {},
      status: () => res,
      json: (data: any) => {
        jsonBody = data;
        return res;
      },
    };

    await handler(req, res);

    // 1. Defunct Station 101 must be dropped before calling /latest
    expect(calledLatestUrls.some((u) => u.includes('/101/latest'))).toBe(false);

    // 2. Station 102 was called for /latest, but skipped because its measurement was stale
    expect(calledLatestUrls.some((u) => u.includes('/102/latest'))).toBe(true);

    // 3. Station 103 was called and chosen
    expect(calledLatestUrls.some((u) => u.includes('/103/latest'))).toBe(true);
    expect(jsonBody.source).toBe('OpenAQ');
    expect(jsonBody.station).toBe('Fresh Station 103');
    expect(jsonBody.pm25).toBe(84.5);
    expect(jsonBody.pm10).toBe(142.0);
    expect(jsonBody.fallbackReason).toBeUndefined();

    // 4. Station 104 was never called because 103 succeeded
    expect(calledLatestUrls.some((u) => u.includes('/104/latest'))).toBe(false);
  });

  it('computes AQI from PM2.5 alone if PM10 is missing or stale', async () => {
    process.env.OPENAQ_API_KEY = 'test_key';
    let jsonBody: any = null;

    const now = Date.now();
    const freshTime = new Date(now - 30 * 60 * 1000).toISOString(); // 30 min ago
    const staleTime = new Date(now - 6 * 3600 * 1000).toISOString(); // 6 hours ago

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/v3/locations?')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              results: [
                {
                  id: 201,
                  name: 'PM2.5 Only Station',
                  coordinates: { latitude: 28.61, longitude: 77.21 },
                  datetimeLast: { utc: freshTime },
                  sensors: [
                    { id: 11, name: 'pm25', parameter: { name: 'pm25' } },
                    { id: 12, name: 'pm10', parameter: { name: 'pm10' } },
                  ],
                },
              ],
            }),
        });
      }

      if (url.includes('/201/latest')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              results: [
                {
                  sensorsId: 11,
                  value: 60, // PM2.5=60 -> AQI 100
                  datetime: { utc: freshTime },
                },
                {
                  sensorsId: 12,
                  value: 300, // PM10 is stale (6 hours old) -> must be ignored!
                  datetime: { utc: staleTime },
                },
              ],
            }),
        });
      }

      return Promise.resolve({ ok: false, status: 500 });
    });

    const req: any = { query: { lat: '28.6139', lon: '77.2090' } };
    const res: any = {
      setHeader: () => {},
      status: () => res,
      json: (data: any) => {
        jsonBody = data;
        return res;
      },
    };

    await handler(req, res);

    expect(jsonBody.source).toBe('OpenAQ');
    expect(jsonBody.pm25).toBe(60);
    expect(jsonBody.pm10).toBeNull();
    // PM2.5=60 corresponds to AQI 100 (if stale PM10=300 was used it would have been AQI 250)
    expect(jsonBody.aqi).toBe(100);
  });

  it('reports total stations checked and freshest age when all candidates are stale', async () => {
    process.env.OPENAQ_API_KEY = 'test_key';
    let jsonBody: any = null;

    const now = Date.now();
    // 3 stations, all with datetimeLast between 5.0 and 8.0 hours ago
    const st1Time = new Date(now - 5 * 3600 * 1000).toISOString(); // 5h ago (freshest)
    const st2Time = new Date(now - 6 * 3600 * 1000).toISOString(); // 6h ago
    const st3Time = new Date(now - 8 * 3600 * 1000).toISOString(); // 8h ago

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/v3/locations?')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              results: [
                {
                  id: 301,
                  name: 'Stale 1',
                  coordinates: { latitude: 28.61, longitude: 77.21 },
                  datetimeLast: { utc: st1Time },
                  sensors: [{ id: 1, name: 'pm25', parameter: { name: 'pm25' } }],
                },
                {
                  id: 302,
                  name: 'Stale 2',
                  coordinates: { latitude: 28.62, longitude: 77.22 },
                  datetimeLast: { utc: st2Time },
                  sensors: [{ id: 2, name: 'pm25', parameter: { name: 'pm25' } }],
                },
                {
                  id: 303,
                  name: 'Stale 3',
                  coordinates: { latitude: 28.63, longitude: 77.23 },
                  datetimeLast: { utc: st3Time },
                  sensors: [{ id: 3, name: 'pm25', parameter: { name: 'pm25' } }],
                },
              ],
            }),
        });
      }

      if (url.includes('open-meteo.com')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              current: { time: '2026-11-21T17:30', pm2_5: 70, pm10: 110 },
            }),
        });
      }

      return Promise.resolve({ ok: false, status: 500 });
    });

    const req: any = { query: { lat: '28.6139', lon: '77.2090' } };
    const res: any = {
      setHeader: () => {},
      status: () => res,
      json: (data: any) => {
        jsonBody = data;
        return res;
      },
    };

    await handler(req, res);

    expect(jsonBody.source).toBe('Modelled estimate (CAMS via Open-Meteo)');
    expect(jsonBody.fallbackReason).toContain('3 stations checked within 25 km');
    expect(jsonBody.fallbackReason).toContain('freshest was 5.0 hours old');
  });
});
