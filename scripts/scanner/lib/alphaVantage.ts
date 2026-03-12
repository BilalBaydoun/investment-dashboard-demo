const AV_BASE = 'https://www.alphavantage.co/query';

// Rate limiter: 75 calls/min = 1 call per 800ms minimum
class RateLimiter {
  private timestamps: number[] = [];
  private maxCalls: number;
  private windowMs: number;

  constructor(maxCalls = 74, windowMs = 60_000) {
    this.maxCalls = maxCalls;
    this.windowMs = windowMs;
  }

  async wait(): Promise<void> {
    const now = Date.now();
    // Remove timestamps outside the window
    this.timestamps = this.timestamps.filter(t => now - t < this.windowMs);

    if (this.timestamps.length >= this.maxCalls) {
      const oldest = this.timestamps[0];
      const waitMs = this.windowMs - (now - oldest) + 100; // 100ms buffer
      if (waitMs > 0) {
        await sleep(waitMs);
      }
      // Clean up again after waiting
      const newNow = Date.now();
      this.timestamps = this.timestamps.filter(t => newNow - t < this.windowMs);
    }

    this.timestamps.push(Date.now());
  }

  get callsMade(): number {
    const now = Date.now();
    this.timestamps = this.timestamps.filter(t => now - t < this.windowMs);
    return this.timestamps.length;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const rateLimiter = new RateLimiter();

function getApiKey(): string {
  const key = process.env.ALPHA_VANTAGE_KEY;
  if (!key) {
    throw new Error('ALPHA_VANTAGE_KEY environment variable is required');
  }
  return key;
}

function checkError(data: any): string | null {
  if (data['Error Message']) return data['Error Message'];
  if (data['Note']) return 'Rate limit reached';
  if (data['Information']) return data['Information'];
  return null;
}

async function avFetch(params: Record<string, string>, retries = 3): Promise<any> {
  const apiKey = getApiKey();
  const url = new URL(AV_BASE);
  url.searchParams.set('apikey', apiKey);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  for (let attempt = 0; attempt < retries; attempt++) {
    await rateLimiter.wait();

    try {
      const response = await fetch(url.toString());
      if (!response.ok) {
        if (response.status === 429 && attempt < retries - 1) {
          console.warn(`Rate limited, waiting 30s before retry...`);
          await sleep(30_000);
          continue;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const error = checkError(data);

      if (error && error.includes('rate limit') || error?.includes('Rate limit') || error?.includes('call frequency')) {
        if (attempt < retries - 1) {
          console.warn(`Rate limit hit, waiting 60s before retry...`);
          await sleep(60_000);
          continue;
        }
      }

      if (error) {
        throw new Error(error);
      }

      return data;
    } catch (err) {
      if (attempt === retries - 1) throw err;
      await sleep((attempt + 1) * 5000);
    }
  }
}

export function parseNumber(value: string | number | undefined | null): number {
  if (value === undefined || value === null || value === 'None' || value === '-' || value === '') return 0;
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return isNaN(num) ? 0 : num;
}

export async function fetchListingStatus(): Promise<string> {
  const apiKey = getApiKey();
  await rateLimiter.wait();

  const url = `${AV_BASE}?function=LISTING_STATUS&apikey=${apiKey}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch listing status: ${response.status}`);
  return response.text();
}

export async function fetchOverview(symbol: string): Promise<any | null> {
  try {
    const data = await avFetch({ function: 'OVERVIEW', symbol });
    if (!data.Symbol) return null;
    return data;
  } catch {
    return null;
  }
}

export async function fetchGlobalQuote(symbol: string): Promise<any | null> {
  try {
    const data = await avFetch({ function: 'GLOBAL_QUOTE', symbol });
    const gq = data['Global Quote'];
    if (!gq || !gq['05. price']) return null;
    return gq;
  } catch {
    return null;
  }
}

export async function fetchTechnical(
  func: string,
  symbol: string,
  params: Record<string, string> = {}
): Promise<any | null> {
  try {
    const data = await avFetch({
      function: func,
      symbol,
      interval: 'daily',
      time_period: '14',
      series_type: 'close',
      ...params,
    });
    return data;
  } catch {
    return null;
  }
}

export { rateLimiter };
