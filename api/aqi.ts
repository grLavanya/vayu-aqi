import type { VercelRequest, VercelResponse } from '@vercel/node';
import { calculateCpcbAqi } from '../src/lib/cpcbAqi';

export interface AqiResponse {
  aqi: number;
  pm25: number;
  pm10: number;
  city: string;
  source: string;
  station: string;
  distanceKm: number;
  timestamp: number;
  fallbackReason?: string;
  keyPresent?: boolean;
}

function getDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  // Query param parsing (works in Vercel and generic Node/Express/Vite requests)
  const query = (req.query ?? {}) as Record<string, string | undefined>;
  const rawLat = query.lat;
  const rawLon = query.lon;
  const requestedCity = query.city?.trim() || '';

  const lat = parseFloat(rawLat ?? '');
  const lon = parseFloat(rawLon ?? '');

  // Validation: numbers, roughly inside India (lat 6-37, lon 68-98)
  if (
    isNaN(lat) ||
    isNaN(lon) ||
    lat < 6 ||
    lat > 37 ||
    lon < 68 ||
    lon > 98
  ) {
    return res.status(400).json({
      error:
        'Coordinates must be valid numbers within India (latitude 6 to 37, longitude 68 to 98).',
    });
  }

  // Set Cache-Control header
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=300');

  // Read OpenAQ API Key from environment. NEVER send to browser or log the key value.
  const openAqKey = process.env.OPENAQ_API_KEY?.trim();
  const keyPresent = Boolean(openAqKey);
  let fallbackReason = '';

  // 1. PRIMARY SOURCE: OpenAQ v3
  if (!openAqKey) {
    fallbackReason = 'key missing';
  } else {
    try {
      const coordsStr = `${lat.toFixed(4)},${lon.toFixed(4)}`;
      let locations: any[] = [];
      let page = 1;
      const maxPages = 3;

      // Query /v3/locations with coordinates, radius=25000, parameters_id=2 (PM2.5) and limit=100
      while (page <= maxPages) {
        const pageUrl = `https://api.openaq.org/v3/locations?coordinates=${encodeURIComponent(coordsStr)}&radius=25000&parameters_id=2&limit=100&page=${page}`;
        const locRes = await fetch(pageUrl, {
          headers: {
            'X-API-Key': openAqKey,
          },
        });

        if (!locRes.ok) {
          if (page === 1) {
            fallbackReason = `HTTP status ${locRes.status} from OpenAQ`;
          }
          break;
        }

        const locData = await locRes.json();
        const pageResults = Array.isArray(locData.results) ? locData.results : [];
        locations = locations.concat(pageResults);
        const found = typeof locData.meta?.found === 'number' ? locData.meta.found : 0;
        if (pageResults.length < 100 || locations.length >= found) {
          break;
        }
        page++;
      }

      const totalStationsChecked = locations.length;
      if (totalStationsChecked === 0) {
        if (!fallbackReason) {
          fallbackReason = 'zero stations found within 25 km';
        }
      } else {
        const threeHoursMs = 3 * 60 * 60 * 1000;
        const now = Date.now();
        let freshestAgeMs: number | null = null;

        // Inspect per-location datetimeLast and drop any location whose last update is older than 3 hours BEFORE calling /latest
        const freshLocations = locations
          .filter((loc: any) => {
            const rawDt =
              loc.datetimeLast?.utc ??
              loc.datetimeLast?.local ??
              loc.datetimeLast;
            const lastUpdateMs = rawDt ? new Date(rawDt).getTime() : 0;
            if (lastUpdateMs && !isNaN(lastUpdateMs)) {
              const ageMs = now - lastUpdateMs;
              if (freshestAgeMs === null || ageMs < freshestAgeMs) {
                freshestAgeMs = ageMs;
              }
              return ageMs <= threeHoursMs;
            }
            return false;
          })
          .map((loc: any) => {
            const locLat = loc.coordinates?.latitude;
            const locLon = loc.coordinates?.longitude;
            let distKm = 9999;
            if (typeof locLat === 'number' && typeof locLon === 'number') {
              distKm = getDistanceKm(lat, lon, locLat, locLon);
            } else if (typeof loc.distance === 'number') {
              distKm =
                loc.distance > 100
                  ? Math.round((loc.distance / 1000) * 10) / 10
                  : Math.round(loc.distance * 10) / 10;
            }
            return { ...loc, distKm };
          })
          .sort((a: any, b: any) => a.distKm - b.distKm);

        if (freshLocations.length === 0) {
          const freshestHours =
            freshestAgeMs !== null
              ? (freshestAgeMs / (1000 * 60 * 60)).toFixed(1)
              : 'unknown';
          fallbackReason = `${totalStationsChecked} stations checked within 25 km, all readings older than 3 hours (freshest was ${freshestHours} hours old)`;
        } else {
          // Call /latest for the nearest 3 only
          for (const station of freshLocations.slice(0, 3)) {
            const sensors = Array.isArray(station.sensors)
              ? station.sensors
              : [];

            const pm25SensorIds = new Set(
              sensors
                .filter((s: any) => {
                  const name = (s.parameter?.name || s.name || '')
                    .toLowerCase()
                    .replace(/[^a-z0-9]/g, '');
                  return name === 'pm25';
                })
                .map((s: any) => s.id),
            );

            const pm10SensorIds = new Set(
              sensors
                .filter((s: any) => {
                  const name = (s.parameter?.name || s.name || '')
                    .toLowerCase()
                    .replace(/[^a-z0-9]/g, '');
                  return name === 'pm10';
                })
                .map((s: any) => s.id),
            );

            // Fetch latest sensor readings for this station
            const latestUrl = `https://api.openaq.org/v3/locations/${station.id}/latest`;
            const latestRes = await fetch(latestUrl, {
              headers: {
                'X-API-Key': openAqKey,
              },
            });

            if (!latestRes.ok) {
              continue;
            }

            const latestData = await latestRes.json();
            const measurements = Array.isArray(latestData.results)
              ? latestData.results
              : [];

            // Ignore any sensor value whose own timestamp is older than 3 hours
            const freshPm25 = measurements
              .filter((m: any) => {
                const sId = m.sensorsId ?? m.sensorId ?? m.sensors_id;
                const pName = (
                  typeof m.parameter === 'string'
                    ? m.parameter
                    : m.parameter?.name || ''
                )
                  .toLowerCase()
                  .replace(/[^a-z0-9]/g, '');
                return (sId && pm25SensorIds.has(sId)) || pName === 'pm25';
              })
              .map((m: any) => {
                const rawTime =
                  m.datetime?.utc ??
                  m.datetime?.local ??
                  m.datetime ??
                  m.period?.datetimeTo?.utc ??
                  m.period?.datetimeTo;
                const timeMs = rawTime ? new Date(rawTime).getTime() : 0;
                return { value: m.value, timeMs };
              })
              .filter(
                (m) =>
                  typeof m.value === 'number' &&
                  m.timeMs > 0 &&
                  now - m.timeMs <= threeHoursMs,
              )
              .sort((a, b) => b.timeMs - a.timeMs);

            if (freshPm25.length === 0) {
              continue;
            }

            const chosenPm25 = freshPm25[0];
            const pm25Val = Math.round(chosenPm25.value * 10) / 10;
            const readingTimestamp = chosenPm25.timeMs;

            // Use PM2.5 and PM10 only from the same station. If PM10 is missing or stale, compute AQI from PM2.5 alone.
            const freshPm10 = measurements
              .filter((m: any) => {
                const sId = m.sensorsId ?? m.sensorId ?? m.sensors_id;
                const pName = (
                  typeof m.parameter === 'string'
                    ? m.parameter
                    : m.parameter?.name || ''
                )
                  .toLowerCase()
                  .replace(/[^a-z0-9]/g, '');
                return (sId && pm10SensorIds.has(sId)) || pName === 'pm10';
              })
              .map((m: any) => {
                const rawTime =
                  m.datetime?.utc ??
                  m.datetime?.local ??
                  m.datetime ??
                  m.period?.datetimeTo?.utc ??
                  m.period?.datetimeTo;
                const timeMs = rawTime ? new Date(rawTime).getTime() : 0;
                return { value: m.value, timeMs };
              })
              .filter(
                (m) =>
                  typeof m.value === 'number' &&
                  m.timeMs > 0 &&
                  now - m.timeMs <= threeHoursMs,
              )
              .sort((a, b) => b.timeMs - a.timeMs);

            const pm10Val =
              freshPm10.length > 0
                ? Math.round(freshPm10[0].value * 10) / 10
                : 0;

            const aqi = calculateCpcbAqi({
              pm25: pm25Val,
              pm10: pm10Val > 0 ? pm10Val : null,
            });

            if (aqi !== null) {
              const result: AqiResponse = {
                aqi,
                pm25: pm25Val,
                pm10: pm10Val,
                city: requestedCity || station.locality || station.name,
                source: 'OpenAQ',
                station: station.name || 'OpenAQ Station',
                distanceKm: station.distKm,
                timestamp: readingTimestamp,
              };
              return res.status(200).json(result);
            }
          }

          if (!fallbackReason) {
            const freshestHours =
              freshestAgeMs !== null
                ? (freshestAgeMs / (1000 * 60 * 60)).toFixed(1)
                : 'unknown';
            fallbackReason = `${totalStationsChecked} stations checked within 25 km, all readings older than 3 hours (freshest was ${freshestHours} hours old)`;
          }
        }
      }
    } catch (err: any) {
      fallbackReason = `OpenAQ request failed (${err.message || 'network error'})`;
    }
  }

  // Log fallback reason server-side (never log the API key itself)
  console.log(
    `[api/aqi] OpenAQ skipped: ${fallbackReason} | keyPresent: ${keyPresent}`,
  );

  // 2. FALLBACK: Open-Meteo Air Quality API
  try {
    const omUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=pm2_5,pm10&timezone=auto`;
    const omRes = await fetch(omUrl);

    if (omRes.ok) {
      const omData = await omRes.json();
      const current = omData.current;

      if (
        current &&
        (typeof current.pm2_5 === 'number' || typeof current.pm10 === 'number')
      ) {
        const pm25Val =
          typeof current.pm2_5 === 'number'
            ? Math.round(current.pm2_5 * 10) / 10
            : 0;
        const pm10Val =
          typeof current.pm10 === 'number'
            ? Math.round(current.pm10 * 10) / 10
            : 0;

        const aqi = calculateCpcbAqi({
          pm25: typeof current.pm2_5 === 'number' ? pm25Val : null,
          pm10: typeof current.pm10 === 'number' ? pm10Val : null,
        });

        if (aqi !== null) {
          let readingTimestamp = Date.now();
          if (current.time) {
            const parsedTime = new Date(current.time).getTime();
            if (!isNaN(parsedTime)) {
              readingTimestamp = parsedTime;
            }
          }

          const result: AqiResponse = {
            aqi,
            pm25: pm25Val,
            pm10: pm10Val,
            city: requestedCity || 'India',
            source: 'Modelled estimate (CAMS via Open-Meteo)',
            station: 'Model grid',
            distanceKm: 0,
            timestamp: readingTimestamp,
            fallbackReason,
            keyPresent,
          };
          return res.status(200).json(result);
        }
      }
    }
  } catch {
    // Both sources failed
  }

  // 3. If BOTH sources fail, return an error
  return res.status(502).json({
    error: "We couldn't fetch the air reading right now",
    fallbackReason,
    keyPresent,
  });
}
