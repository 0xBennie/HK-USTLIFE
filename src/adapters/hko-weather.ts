export const CURRENT_WEATHER_URL =
  'https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=rhrread&lang=en';
export const WARNINGS_URL =
  'https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=warnsum&lang=en';

export type Fetcher = (input: string, init?: RequestInit) => Promise<Pick<Response, 'ok' | 'json'>>;

export interface WeatherSnapshot {
  temperatureC: number | null;
  humidityPercent: number | null;
  iconCode: number | null;
  observedAt: string | null;
  updatedAt: string | null;
  warnings: string[];
  fetchedAt: string;
  sourceUrl: string;
  warningSourceUrl: string;
}

interface HkoPoint {
  place?: string;
  value?: number;
}

interface CurrentWeatherPayload {
  temperature?: { data?: HkoPoint[]; recordTime?: string };
  humidity?: { data?: HkoPoint[] };
  icon?: number[];
  updateTime?: string;
}

interface WarningPayload {
  [warningId: string]: { name?: string; actionCode?: string } | undefined;
}

async function fetchJson(fetcher: Fetcher, url: string): Promise<unknown> {
  const response = await fetcher(url, {
    headers: { 'user-agent': 'hkust-life-mcp/0.1 (public weather brief)' },
  });

  if (!response.ok) {
    throw new Error(`Public weather source returned an unsuccessful response: ${url}`);
  }

  return response.json();
}

function readingAt(points: HkoPoint[] | undefined, place: string): number | null {
  const value = points?.find((point) => point.place === place)?.value;
  return typeof value === 'number' ? value : null;
}

function activeWarningNames(payload: WarningPayload): string[] {
  return Object.values(payload)
    .filter((warning): warning is { name: string; actionCode?: string } =>
      typeof warning?.name === 'string' && warning.actionCode !== 'CANCEL',
    )
    .map((warning) => warning.name)
    .sort();
}

export async function getHongKongWeather(
  fetcher: Fetcher = fetch,
  now: Date = new Date(),
): Promise<WeatherSnapshot> {
  const [currentWeather, warnings] = await Promise.all([
    fetchJson(fetcher, CURRENT_WEATHER_URL),
    fetchJson(fetcher, WARNINGS_URL),
  ]);
  const current = currentWeather as CurrentWeatherPayload;

  return {
    temperatureC: readingAt(current.temperature?.data, 'Hong Kong Observatory'),
    humidityPercent: readingAt(current.humidity?.data, 'Hong Kong Observatory'),
    iconCode: typeof current.icon?.[0] === 'number' ? current.icon[0] : null,
    observedAt: current.temperature?.recordTime ?? null,
    updatedAt: current.updateTime ?? null,
    warnings: activeWarningNames(warnings as WarningPayload),
    fetchedAt: now.toISOString(),
    sourceUrl: CURRENT_WEATHER_URL,
    warningSourceUrl: WARNINGS_URL,
  };
}
