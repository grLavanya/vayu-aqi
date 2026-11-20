export interface AqiReading {
  aqi: number;
  pm25: number;
  pm10: number;
  city: string;
  source: string;
  station: string;
  distanceKm: number;
  timestamp: number;
}

// TODO_REAL: replace with a live data provider (e.g. CPCB / OpenAQ).
export async function getAqi(city: string): Promise<AqiReading> {
  return {
    aqi: 168,
    pm25: 74.2,
    pm10: 121.5,
    city: city || 'Bengaluru',
    source: 'CPCB',
    station: 'Bapunagar, AMD',
    distanceKm: 3.4,
    timestamp: Date.now(),
  };
}
