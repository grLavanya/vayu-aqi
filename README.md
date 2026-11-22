# Vayu — Your Urban Air Companion

Vayu is a calm, responsive urban air quality assistant designed for Indian families. It provides real-time AQI readings, Indian CPCB-based health categories, and personalized, gentle daily action plans.

---

## Environment Variables

Create a `.env.local` file in the root of the project (this file is excluded by `.gitignore`):

| Variable | Description | Required? |
|---|---|---|
| `OPENAQ_API_KEY` | API key for OpenAQ v3 (`X-API-Key` header). Enables fetching live physical ground station data across India. | Optional (Recommended). If omitted, Vayu gracefully falls back to Open-Meteo modelled CAMS data. |
| `GEMINI_API_KEY` | API key for Google Gemini generative AI. Used to generate personalized daily action plans based on real AQI readings and household profiles. | Optional (Recommended). If omitted, Vayu automatically uses a calm, pure rule-based fallback plan. |
| `GEMINI_MODEL` | Gemini model identifier used for plan generation. Defaults to `gemini-3.1-flash-lite`. | Optional. Default: `gemini-3.1-flash-lite`. |

To configure your API keys:
1. **OpenAQ**: Sign up at [https://explore.openaq.org/register](https://explore.openaq.org/register).
2. **Gemini**: Obtain an API key from [Google AI Studio](https://aistudio.google.com/).
3. Copy your API keys into `.env.local`:
   ```bash
   OPENAQ_API_KEY=your_openaq_api_key_here
   GEMINI_API_KEY=your_gemini_api_key_here
   # Optional: customize model (defaults to gemini-3.1-flash-lite)
   GEMINI_MODEL=gemini-3.1-flash-lite
   ```

---

## Local Development Setup

### Option 1: Running with Vercel CLI (Recommended for production emulation)
Since Vayu utilizes a Vercel Serverless Function at `api/aqi.ts`, you can run the full environment locally with `vercel dev`:

1. **Install Vercel CLI** (globally or invoke via npx):
   ```bash
   npm install -g vercel
   ```
2. **Link the project** (first time only):
   ```bash
   vercel link
   ```
3. **Start the local development server**:
   ```bash
   vercel dev
   ```
   This will start both Vite frontend and the serverless API proxy at `http://localhost:3000`.

### Option 2: Running with Vite Dev Server
Vayu includes an integrated Vite development plugin in `vite.config.ts` that automatically routes `/api/aqi` to `api/aqi.ts`:

1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Start the Vite dev server**:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:5173` in your browser.

---

## Running Tests

Vayu uses [Vitest](https://vitest.dev/) to test the CPCB NAQI formula across all PM2.5 and PM10 breakpoint boundaries:

```bash
npm test
```

---

## Architecture & Data Flow

1. **Serverless Proxy (`api/aqi.ts`)**:
   - Accepts `lat` and `lon` query parameters.
   - Validates coordinates within India (lat: 6° to 37°, lon: 68° to 98°).
   - Sets HTTP `Cache-Control: s-maxage=600, stale-while-revalidate=300`.
   - Never logs or exposes the `OPENAQ_API_KEY` to the browser client.

2. **Primary Source (OpenAQ v3)**:
   - Queries `https://api.openaq.org/v3/locations?coordinates=LAT,LON&radius=25000` with the `X-API-Key` header.
   - Identifies nearest stations reporting PM2.5 within 25 km.
   - Evaluates the newest measurement timestamp: if the reading is older than 3 hours, evaluates the next nearest station.
   - Returns the true station name, calculated distance in km, and real observation timestamp.

3. **Fallback Source (Open-Meteo)**:
   - If no fresh OpenAQ stations are within range, queries the Open-Meteo Air Quality API (`https://air-quality-api.open-meteo.com/v1/air-quality`).
   - Honestly labels the source as `Modelled estimate (CAMS via Open-Meteo)` with station `Model grid` and displays required attribution.

4. **CPCB NAQI Calculation (`src/lib/cpcbAqi.ts`)**:
   - Calculates linear sub-indices for PM2.5 and PM10 according to the official Indian Central Pollution Control Board (CPCB) scale.
   - Computes `AQI = max(PM2.5 sub-index, PM10 sub-index)`.
   - Marked clearly: "estimated from the latest PM2.5/PM10 reading".

5. **First Load & Location Selection**:
   - On initial visit with no saved history, shows a calm empty state ("Choose your city or use your location to see today's air") without defaulting to any city.
   - Remembers the user's last selected location in `localStorage` across visits.
   - Location search autocompletes with Open-Meteo geocoding restricted to India.
