# Vayu — Your Urban Air Companion

Vayu is a calm urban air quality assistant for Indian households. It shows live AQI for any Indian city with its source and timestamp, then turns it into a gentle, personalised plan for the day: morning/afternoon/evening actions, indoor-air advice and greener swaps with a short reason for each.

**Live demo:** https://vayu-aqi.vercel.app

---

## What it does

- **Live AQI for any Indian city.** Search a city or use your location. No city is assumed on first load; the last city is remembered in `localStorage`.
- **Honest data.** Every reading shows its source, station, distance and "updated" time. If no fresh ground station is nearby, Vayu falls back to a clearly labelled modelled estimate.
- **Personalised plans.** Choose who is at home (young children, senior at home, daily commuter, student/sports, has air purifier) or tap a sample household. Plans change with the household and the air-quality band.
- **Calm by design.** Four bands (Clear, Hazy, Heavy, Dense), each with its own colour mood, a "You could..." tone, and no guilt, streak or alarm styling.
- **Never breaks.** If the AI is unavailable or its output fails validation, a rule-based plan is shown instead, marked "Standard guidance".

---

## Try it (sample inputs for evaluators)

AQI values come from live stations, so exact numbers change. Check the band wording, the source line and how the plan differs per household.

| Input | What to look for |
|---|---|
| **Delhi** + sample household "Family with two young children" | A higher band in winter, a gentle health note for children, indoor-focused plan |
| **Mumbai** + chips *Young children* and *Has air purifier* | Purifier-specific indoor advice, plan for the Mumbai reading |
| **Bengaluru** + chip *Daily commuter* | Commute-related suggestions (these only appear with this chip) |
| Same city, two different households | The two plans differ |
| **Use my location** (inside India) | Nearest station with distance shown |
| `/api/aqi?lat=28.6139&lon=77.2090` | JSON with AQI, source, station and timestamp |
| `/api/aqi?lat=51.5&lon=-0.12` | Rejected: coordinates must be inside India |
| Run locally without `GEMINI_API_KEY` | Rule-based plan with a "Standard guidance" note |

---

## How GenAI is used

| Done by Gemini | Done by code (never by AI) |
|---|---|
| Writes the personalised plan: day-part actions, indoor-air advice, greener swaps with reasons | Fetches live readings (OpenAQ, Open-Meteo) |
| Adapts wording to the AQI band and household | Computes the CPCB AQI from PM2.5/PM10 |
| | Picks the band word, validates and filters the AI output |

**Prompt flow:** city + CPCB AQI + band + local time + household chips → prompt (`src/prompts/planPrompt.ts`) → Gemini returns structured JSON → `planGuard` validates it → plan is shown, or the rule-based plan (`rulePlan.ts`) replaces it.

**Prompt rules:** use only the AQI/PM numbers provided, never invent figures; describe air only with the four band words; suggest commute or vehicle swaps only when the *Daily commuter* chip is selected.

**Guard:** `planGuard` rejects plans that quote a wrong AQI/PM value or contain invented numbers (percentages, kg, litres, times, "fold" claims).

Model: `gemini-3.1-flash-lite` by default (`GEMINI_MODEL` overrides). The API key is only used server-side.

---

## Architecture & data flow

1. **Serverless proxy (`api/aqi.ts`)**
   - Accepts `lat` and `lon`, validated inside India (lat 6° to 37°, lon 68° to 98°).
   - Sets `Cache-Control: s-maxage=600, stale-while-revalidate=300`.
   - Never exposes `OPENAQ_API_KEY` to the browser.
2. **Primary source: OpenAQ v3**
   - Queries locations within 25 km with the `X-API-Key` header and picks the nearest station reporting PM2.5.
   - If the newest measurement is older than 3 hours, the next nearest station is tried.
   - Returns the real station name, distance and observation time.
3. **Fallback: Open-Meteo**
   - If no fresh station is in range, uses the Open-Meteo Air Quality API.
   - Labelled `Modelled estimate (CAMS via Open-Meteo)` with attribution.
4. **CPCB AQI (`src/lib/cpcbAqi.ts`)**
   - Linear sub-indices for PM2.5 and PM10 on the official CPCB scale; `AQI = max(sub-indices)`.
   - PM2.5 and PM10 are only combined from the same station. If PM10 is missing or stale, the AQI uses PM2.5 alone.
   - Shown as "estimated from the latest PM2.5/PM10 reading".
5. **Plan generation (`api/plan.ts`)**
   - Calls Gemini server-side, validates with `planGuard`, falls back to `rulePlan`, and keeps a server-side cache.
   - The client caches plans for 30 minutes and debounces requests (800 ms).
6. **First load**
   - A calm empty state ("Choose your city or use your location to see today's air"). Location search autocompletes with Open-Meteo geocoding restricted to India.

### Project structure
```
api/
  aqi.ts          Live AQI proxy (OpenAQ -> Open-Meteo), CPCB AQI
  plan.ts         Gemini plan generation, guard, fallback, server cache
src/
  lib/
    cpcbAqi.ts    CPCB sub-index and AQI maths
    mood.ts       AQI to band/mood
    rulePlan.ts   Rule-based fallback plan and Plan types
    planGuard.ts  Validates AI output
    aqiService.ts, planService.ts   Client fetching, caching, debounce
  prompts/
    planPrompt.ts Prompt and plan rules
```

---

## Environment variables

Create `.env.local` in the project root (git-ignored):

| Variable | Description | Required? |
|---|---|---|
| `OPENAQ_API_KEY` | OpenAQ v3 key (`X-API-Key`). Enables live ground-station data. | Optional (recommended). Without it, Vayu falls back to Open-Meteo modelled data. |
| `GEMINI_API_KEY` | Google Gemini key for plan generation. | Optional (recommended). Without it, the rule-based plan is used. |
| `GEMINI_MODEL` | Gemini model name. | Optional. Default `gemini-3.1-flash-lite`. |

```bash
OPENAQ_API_KEY=your_openaq_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
# Optional
GEMINI_MODEL=gemini-3.1-flash-lite
```

Keys: [OpenAQ](https://explore.openaq.org/register), [Google AI Studio](https://aistudio.google.com/). On Vercel, add the same variables under Project Settings, then redeploy.

---

## Local development

**Option 1: Vercel CLI (closest to production)**
```bash
npm install -g vercel
vercel link     # first time only
vercel dev      # frontend and API functions at http://localhost:3000
```

**Option 2: Vite dev server**
`vite.config.ts` includes a dev plugin that routes the `api/aqi` and `api/plan` handlers.
```bash
npm install
npm run dev     # http://localhost:5173
```

---

## Tests

```bash
npm test
```

Vitest covers the CPCB NAQI formula at every PM2.5/PM10 breakpoint boundary, the `/api/aqi` and `/api/plan` handlers, the plan guard (rejecting wrong values and invented numbers) and the rule-based plan.

---

## Security & privacy

- API keys live only in server-side environment variables and are never sent to the browser.
- Coordinates are validated server-side and must be inside India.
- AI output is validated before display; unsafe or invalid output is replaced by rule-based guidance.
- No accounts and no database. The only stored data is the last city, in the browser's `localStorage`.

---

## Notes and limitations

- Indoor guidance is advice only; Vayu has no indoor sensor data.
- AQI is estimated from PM2.5/PM10 only, so it can differ from official CPCB bulletins.
- Station coverage varies by city. Where no fresh station is nearby, the app says the reading is modelled.
- Vayu informs; it doesn't replace medical advice.
- Vercel functions run as native ESM, so relative imports in `api/` and the files they import need a `.js` extension (for example `'../src/lib/cpcbAqi.js'`).

---

## Built with

React 18, TypeScript, Vite, Tailwind CSS, Vitest, Vercel serverless functions, Google Gemini API, OpenAQ, Open-Meteo. Built with AI assistance from Bolt.new (initial scaffold) and Google Antigravity.