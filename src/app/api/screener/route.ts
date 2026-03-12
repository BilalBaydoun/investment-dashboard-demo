import { NextRequest, NextResponse } from 'next/server';

const ALPHA_VANTAGE_BASE = 'https://www.alphavantage.co/query';

interface AlphaVantageFundamentals {
  symbol: string;
  peRatio: number;
  pegRatio: number;
  pbRatio: number;
  roe: number;
  profitMargin: number;
  operatingMargin: number;
  dividendYield: number;
  eps: number;
  analystTargetPrice: number;
  week52High: number;
  week52Low: number;
  beta: number;
  revenueGrowth: number;
  earningsGrowth: number;
  priceToSales: number;
  evToEbitda: number;
}

// Fundamentals cache (1 hour expiry)
const fundamentalsCache: Map<string, { data: AlphaVantageFundamentals; timestamp: number }> = new Map();
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

interface ProcessedStock {
  symbol: string;
  name: string;
  sector: string;
  industry: string;
  currentPrice: number;
  targetPrice: number;
  fairValue: number;
  upside: number;
  buyScore: number;
  rating: 'strong_buy' | 'buy' | 'hold' | 'sell';
  confidence: number;
  marketCap: number;
  marketCapCategory: string;
  pe: number;
  pbRatio: number;
  roe: number;
  profitMargin: number;
  dividendYield: number;
  priceToSales: number;
  dayChange: number;
  dayChangePercent: number;
  volume: number;
  dayHigh: number;
  dayLow: number;
  below52WeekHigh: number;
  above52WeekLow: number;
  reasonsToConsider: string[];
  risks: string[];
  valuationStatus: 'undervalued' | 'fair' | 'overvalued';
  discountToFairValue: number;
}

// Stock metadata with estimated prices for fallback
// Prices are estimates and will be replaced with live data when API works
const STOCK_METADATA: Record<string, { name: string; sector: string; industry: string; marketCap: number; avgPE: number; dividendYield: number; estimatedPrice: number }> = {
  // Technology - Large Cap
  'AAPL': { name: 'Apple Inc.', sector: 'Technology', industry: 'Consumer Electronics', marketCap: 2800e9, avgPE: 28, dividendYield: 0.5, estimatedPrice: 185 },
  'MSFT': { name: 'Microsoft Corporation', sector: 'Technology', industry: 'Software', marketCap: 2700e9, avgPE: 32, dividendYield: 0.8, estimatedPrice: 375 },
  'GOOGL': { name: 'Alphabet Inc.', sector: 'Technology', industry: 'Internet Services', marketCap: 1700e9, avgPE: 24, dividendYield: 0, estimatedPrice: 142 },
  'META': { name: 'Meta Platforms Inc.', sector: 'Technology', industry: 'Social Media', marketCap: 900e9, avgPE: 22, dividendYield: 0.4, estimatedPrice: 520 },
  'NVDA': { name: 'NVIDIA Corporation', sector: 'Technology', industry: 'Semiconductors', marketCap: 1200e9, avgPE: 55, dividendYield: 0.03, estimatedPrice: 135 },
  'AMD': { name: 'Advanced Micro Devices', sector: 'Technology', industry: 'Semiconductors', marketCap: 200e9, avgPE: 40, dividendYield: 0, estimatedPrice: 125 },
  'INTC': { name: 'Intel Corporation', sector: 'Technology', industry: 'Semiconductors', marketCap: 150e9, avgPE: 15, dividendYield: 1.5, estimatedPrice: 35 },
  'CRM': { name: 'Salesforce Inc.', sector: 'Technology', industry: 'Software', marketCap: 250e9, avgPE: 45, dividendYield: 0, estimatedPrice: 265 },
  'ADBE': { name: 'Adobe Inc.', sector: 'Technology', industry: 'Software', marketCap: 220e9, avgPE: 35, dividendYield: 0, estimatedPrice: 495 },
  'ORCL': { name: 'Oracle Corporation', sector: 'Technology', industry: 'Software', marketCap: 300e9, avgPE: 22, dividendYield: 1.2, estimatedPrice: 115 },
  'CSCO': { name: 'Cisco Systems Inc.', sector: 'Technology', industry: 'Networking', marketCap: 200e9, avgPE: 15, dividendYield: 3.0, estimatedPrice: 48 },
  'IBM': { name: 'IBM Corporation', sector: 'Technology', industry: 'IT Services', marketCap: 150e9, avgPE: 18, dividendYield: 4.5, estimatedPrice: 165 },

  // Technology - Mid/Small Cap (Hidden Gems)
  'PANW': { name: 'Palo Alto Networks', sector: 'Technology', industry: 'Cybersecurity', marketCap: 80e9, avgPE: 45, dividendYield: 0, estimatedPrice: 310 },
  'CRWD': { name: 'CrowdStrike Holdings', sector: 'Technology', industry: 'Cybersecurity', marketCap: 60e9, avgPE: 70, dividendYield: 0, estimatedPrice: 280 },
  'NET': { name: 'Cloudflare Inc.', sector: 'Technology', industry: 'Cloud Services', marketCap: 25e9, avgPE: 200, dividendYield: 0, estimatedPrice: 85 },
  'DDOG': { name: 'Datadog Inc.', sector: 'Technology', industry: 'Software', marketCap: 35e9, avgPE: 80, dividendYield: 0, estimatedPrice: 115 },
  'MDB': { name: 'MongoDB Inc.', sector: 'Technology', industry: 'Database', marketCap: 25e9, avgPE: 150, dividendYield: 0, estimatedPrice: 365 },
  'ZS': { name: 'Zscaler Inc.', sector: 'Technology', industry: 'Cybersecurity', marketCap: 25e9, avgPE: 100, dividendYield: 0, estimatedPrice: 195 },
  'FTNT': { name: 'Fortinet Inc.', sector: 'Technology', industry: 'Cybersecurity', marketCap: 45e9, avgPE: 35, dividendYield: 0, estimatedPrice: 62 },
  'TEAM': { name: 'Atlassian Corporation', sector: 'Technology', industry: 'Software', marketCap: 40e9, avgPE: 80, dividendYield: 0, estimatedPrice: 185 },

  // Healthcare
  'JNJ': { name: 'Johnson & Johnson', sector: 'Healthcare', industry: 'Pharmaceuticals', marketCap: 400e9, avgPE: 15, dividendYield: 3.0, estimatedPrice: 155 },
  'UNH': { name: 'UnitedHealth Group', sector: 'Healthcare', industry: 'Health Insurance', marketCap: 450e9, avgPE: 20, dividendYield: 1.5, estimatedPrice: 525 },
  'PFE': { name: 'Pfizer Inc.', sector: 'Healthcare', industry: 'Pharmaceuticals', marketCap: 160e9, avgPE: 12, dividendYield: 5.5, estimatedPrice: 28 },
  'ABBV': { name: 'AbbVie Inc.', sector: 'Healthcare', industry: 'Pharmaceuticals', marketCap: 280e9, avgPE: 14, dividendYield: 4.0, estimatedPrice: 165 },
  'MRK': { name: 'Merck & Co.', sector: 'Healthcare', industry: 'Pharmaceuticals', marketCap: 280e9, avgPE: 16, dividendYield: 2.5, estimatedPrice: 115 },
  'LLY': { name: 'Eli Lilly', sector: 'Healthcare', industry: 'Pharmaceuticals', marketCap: 550e9, avgPE: 50, dividendYield: 0.8, estimatedPrice: 595 },
  'TMO': { name: 'Thermo Fisher Scientific', sector: 'Healthcare', industry: 'Life Sciences', marketCap: 200e9, avgPE: 28, dividendYield: 0.3, estimatedPrice: 530 },
  'DHR': { name: 'Danaher Corporation', sector: 'Healthcare', industry: 'Life Sciences', marketCap: 180e9, avgPE: 30, dividendYield: 0.4, estimatedPrice: 250 },
  'ABT': { name: 'Abbott Laboratories', sector: 'Healthcare', industry: 'Medical Devices', marketCap: 190e9, avgPE: 22, dividendYield: 2.0, estimatedPrice: 108 },
  'BMY': { name: 'Bristol-Myers Squibb', sector: 'Healthcare', industry: 'Pharmaceuticals', marketCap: 100e9, avgPE: 8, dividendYield: 5.0, estimatedPrice: 48 },

  // Financial
  'JPM': { name: 'JPMorgan Chase', sector: 'Financial Services', industry: 'Banking', marketCap: 500e9, avgPE: 11, dividendYield: 2.5, estimatedPrice: 175 },
  'BAC': { name: 'Bank of America', sector: 'Financial Services', industry: 'Banking', marketCap: 280e9, avgPE: 10, dividendYield: 2.8, estimatedPrice: 35 },
  'WFC': { name: 'Wells Fargo', sector: 'Financial Services', industry: 'Banking', marketCap: 180e9, avgPE: 11, dividendYield: 2.5, estimatedPrice: 52 },
  'GS': { name: 'Goldman Sachs', sector: 'Financial Services', industry: 'Investment Banking', marketCap: 130e9, avgPE: 12, dividendYield: 2.5, estimatedPrice: 395 },
  'MS': { name: 'Morgan Stanley', sector: 'Financial Services', industry: 'Investment Banking', marketCap: 150e9, avgPE: 13, dividendYield: 3.5, estimatedPrice: 92 },
  'V': { name: 'Visa Inc.', sector: 'Financial Services', industry: 'Payments', marketCap: 500e9, avgPE: 28, dividendYield: 0.8, estimatedPrice: 275 },
  'MA': { name: 'Mastercard Inc.', sector: 'Financial Services', industry: 'Payments', marketCap: 400e9, avgPE: 32, dividendYield: 0.6, estimatedPrice: 445 },
  'BLK': { name: 'BlackRock Inc.', sector: 'Financial Services', industry: 'Asset Management', marketCap: 120e9, avgPE: 20, dividendYield: 2.5, estimatedPrice: 795 },
  'SCHW': { name: 'Charles Schwab', sector: 'Financial Services', industry: 'Brokerage', marketCap: 120e9, avgPE: 18, dividendYield: 1.5, estimatedPrice: 68 },
  'AXP': { name: 'American Express', sector: 'Financial Services', industry: 'Credit Services', marketCap: 150e9, avgPE: 17, dividendYield: 1.2, estimatedPrice: 215 },
  // Mid-cap financials (hidden gems)
  'ALLY': { name: 'Ally Financial', sector: 'Financial Services', industry: 'Consumer Finance', marketCap: 10e9, avgPE: 8, dividendYield: 3.5, estimatedPrice: 35 },
  'FITB': { name: 'Fifth Third Bancorp', sector: 'Financial Services', industry: 'Regional Banking', marketCap: 25e9, avgPE: 10, dividendYield: 3.8, estimatedPrice: 38 },
  'RF': { name: 'Regions Financial', sector: 'Financial Services', industry: 'Regional Banking', marketCap: 18e9, avgPE: 9, dividendYield: 4.2, estimatedPrice: 19 },
  'CFG': { name: 'Citizens Financial', sector: 'Financial Services', industry: 'Regional Banking', marketCap: 16e9, avgPE: 9, dividendYield: 4.5, estimatedPrice: 35 },

  // Consumer
  'AMZN': { name: 'Amazon.com Inc.', sector: 'Consumer Cyclical', industry: 'E-Commerce', marketCap: 1500e9, avgPE: 45, dividendYield: 0, estimatedPrice: 178 },
  'TSLA': { name: 'Tesla Inc.', sector: 'Consumer Cyclical', industry: 'Auto Manufacturers', marketCap: 600e9, avgPE: 60, dividendYield: 0, estimatedPrice: 245 },
  'HD': { name: 'Home Depot', sector: 'Consumer Cyclical', industry: 'Home Improvement', marketCap: 350e9, avgPE: 22, dividendYield: 2.5, estimatedPrice: 365 },
  'MCD': { name: "McDonald's Corp.", sector: 'Consumer Cyclical', industry: 'Restaurants', marketCap: 200e9, avgPE: 24, dividendYield: 2.2, estimatedPrice: 285 },
  'NKE': { name: 'Nike Inc.', sector: 'Consumer Cyclical', industry: 'Footwear', marketCap: 150e9, avgPE: 28, dividendYield: 1.3, estimatedPrice: 98 },
  'SBUX': { name: 'Starbucks Corp.', sector: 'Consumer Cyclical', industry: 'Restaurants', marketCap: 100e9, avgPE: 25, dividendYield: 2.5, estimatedPrice: 92 },
  'TGT': { name: 'Target Corporation', sector: 'Consumer Cyclical', industry: 'Retail', marketCap: 70e9, avgPE: 15, dividendYield: 2.8, estimatedPrice: 145 },
  'LOW': { name: "Lowe's Companies", sector: 'Consumer Cyclical', industry: 'Home Improvement', marketCap: 140e9, avgPE: 18, dividendYield: 2.0, estimatedPrice: 235 },
  'PG': { name: 'Procter & Gamble', sector: 'Consumer Defensive', industry: 'Household Products', marketCap: 350e9, avgPE: 24, dividendYield: 2.5, estimatedPrice: 155 },
  'KO': { name: 'Coca-Cola Company', sector: 'Consumer Defensive', industry: 'Beverages', marketCap: 260e9, avgPE: 23, dividendYield: 3.0, estimatedPrice: 62 },
  'PEP': { name: 'PepsiCo Inc.', sector: 'Consumer Defensive', industry: 'Beverages', marketCap: 230e9, avgPE: 22, dividendYield: 2.8, estimatedPrice: 175 },
  'COST': { name: 'Costco Wholesale', sector: 'Consumer Defensive', industry: 'Retail', marketCap: 300e9, avgPE: 42, dividendYield: 0.6, estimatedPrice: 685 },
  'WMT': { name: 'Walmart Inc.', sector: 'Consumer Defensive', industry: 'Retail', marketCap: 450e9, avgPE: 28, dividendYield: 1.4, estimatedPrice: 165 },
  // Mid-cap consumer (hidden gems)
  'TXRH': { name: 'Texas Roadhouse', sector: 'Consumer Cyclical', industry: 'Restaurants', marketCap: 10e9, avgPE: 22, dividendYield: 1.8, estimatedPrice: 145 },
  'WING': { name: 'Wingstop Inc.', sector: 'Consumer Cyclical', industry: 'Restaurants', marketCap: 8e9, avgPE: 80, dividendYield: 0.4, estimatedPrice: 285 },
  'DPZ': { name: "Domino's Pizza", sector: 'Consumer Cyclical', industry: 'Restaurants', marketCap: 15e9, avgPE: 28, dividendYield: 1.2, estimatedPrice: 425 },
  'ORLY': { name: "O'Reilly Automotive", sector: 'Consumer Cyclical', industry: 'Auto Parts', marketCap: 60e9, avgPE: 25, dividendYield: 0, estimatedPrice: 985 },
  'AZO': { name: 'AutoZone Inc.', sector: 'Consumer Cyclical', industry: 'Auto Parts', marketCap: 50e9, avgPE: 20, dividendYield: 0, estimatedPrice: 2750 },

  // Industrial
  'CAT': { name: 'Caterpillar Inc.', sector: 'Industrials', industry: 'Machinery', marketCap: 150e9, avgPE: 15, dividendYield: 2.0, estimatedPrice: 295 },
  'DE': { name: 'Deere & Company', sector: 'Industrials', industry: 'Farm Machinery', marketCap: 120e9, avgPE: 14, dividendYield: 1.5, estimatedPrice: 395 },
  'BA': { name: 'Boeing Company', sector: 'Industrials', industry: 'Aerospace', marketCap: 130e9, avgPE: 35, dividendYield: 0, estimatedPrice: 215 },
  'RTX': { name: 'RTX Corporation', sector: 'Industrials', industry: 'Aerospace & Defense', marketCap: 140e9, avgPE: 18, dividendYield: 2.5, estimatedPrice: 98 },
  'LMT': { name: 'Lockheed Martin', sector: 'Industrials', industry: 'Aerospace & Defense', marketCap: 120e9, avgPE: 17, dividendYield: 2.8, estimatedPrice: 465 },
  'HON': { name: 'Honeywell International', sector: 'Industrials', industry: 'Conglomerate', marketCap: 130e9, avgPE: 20, dividendYield: 2.2, estimatedPrice: 195 },
  'UPS': { name: 'United Parcel Service', sector: 'Industrials', industry: 'Logistics', marketCap: 120e9, avgPE: 16, dividendYield: 4.5, estimatedPrice: 145 },
  'FDX': { name: 'FedEx Corporation', sector: 'Industrials', industry: 'Logistics', marketCap: 65e9, avgPE: 14, dividendYield: 2.0, estimatedPrice: 265 },
  'GE': { name: 'General Electric', sector: 'Industrials', industry: 'Conglomerate', marketCap: 180e9, avgPE: 25, dividendYield: 0.8, estimatedPrice: 165 },
  // Mid-cap industrials (hidden gems)
  'SAIA': { name: 'Saia Inc.', sector: 'Industrials', industry: 'Trucking', marketCap: 12e9, avgPE: 30, dividendYield: 0, estimatedPrice: 445 },
  'ODFL': { name: 'Old Dominion Freight', sector: 'Industrials', industry: 'Trucking', marketCap: 40e9, avgPE: 32, dividendYield: 0.4, estimatedPrice: 185 },
  'XPO': { name: 'XPO Inc.', sector: 'Industrials', industry: 'Logistics', marketCap: 12e9, avgPE: 22, dividendYield: 0, estimatedPrice: 105 },

  // Energy
  'XOM': { name: 'Exxon Mobil', sector: 'Energy', industry: 'Oil & Gas', marketCap: 450e9, avgPE: 12, dividendYield: 3.5, estimatedPrice: 105 },
  'CVX': { name: 'Chevron Corporation', sector: 'Energy', industry: 'Oil & Gas', marketCap: 280e9, avgPE: 11, dividendYield: 4.0, estimatedPrice: 155 },
  'COP': { name: 'ConocoPhillips', sector: 'Energy', industry: 'Oil & Gas', marketCap: 130e9, avgPE: 10, dividendYield: 3.0, estimatedPrice: 115 },
  'EOG': { name: 'EOG Resources', sector: 'Energy', industry: 'Oil & Gas', marketCap: 70e9, avgPE: 9, dividendYield: 3.2, estimatedPrice: 125 },
  'SLB': { name: 'Schlumberger', sector: 'Energy', industry: 'Oil Services', marketCap: 65e9, avgPE: 14, dividendYield: 2.5, estimatedPrice: 48 },
  'OXY': { name: 'Occidental Petroleum', sector: 'Energy', industry: 'Oil & Gas', marketCap: 50e9, avgPE: 8, dividendYield: 1.5, estimatedPrice: 58 },
  'DVN': { name: 'Devon Energy', sector: 'Energy', industry: 'Oil & Gas', marketCap: 30e9, avgPE: 7, dividendYield: 5.0, estimatedPrice: 45 },
  'HAL': { name: 'Halliburton', sector: 'Energy', industry: 'Oil Services', marketCap: 28e9, avgPE: 10, dividendYield: 2.0, estimatedPrice: 32 },

  // Utilities & Real Estate
  'NEE': { name: 'NextEra Energy', sector: 'Utilities', industry: 'Utilities', marketCap: 150e9, avgPE: 22, dividendYield: 2.8, estimatedPrice: 72 },
  'DUK': { name: 'Duke Energy', sector: 'Utilities', industry: 'Utilities', marketCap: 80e9, avgPE: 17, dividendYield: 4.0, estimatedPrice: 102 },
  'SO': { name: 'Southern Company', sector: 'Utilities', industry: 'Utilities', marketCap: 80e9, avgPE: 18, dividendYield: 3.8, estimatedPrice: 75 },
  'PLD': { name: 'Prologis Inc.', sector: 'Real Estate', industry: 'Industrial REITs', marketCap: 110e9, avgPE: 45, dividendYield: 3.0, estimatedPrice: 125 },
  'AMT': { name: 'American Tower', sector: 'Real Estate', industry: 'Telecom REITs', marketCap: 90e9, avgPE: 40, dividendYield: 3.2, estimatedPrice: 195 },
  'EQIX': { name: 'Equinix Inc.', sector: 'Real Estate', industry: 'Data Center REITs', marketCap: 70e9, avgPE: 80, dividendYield: 2.0, estimatedPrice: 785 },
  'O': { name: 'Realty Income', sector: 'Real Estate', industry: 'Retail REITs', marketCap: 45e9, avgPE: 40, dividendYield: 5.5, estimatedPrice: 55 },

  // Communication
  'GOOG': { name: 'Alphabet Inc. Class C', sector: 'Communication Services', industry: 'Internet Services', marketCap: 1700e9, avgPE: 24, dividendYield: 0, estimatedPrice: 145 },
  'DIS': { name: 'Walt Disney Company', sector: 'Communication Services', industry: 'Entertainment', marketCap: 180e9, avgPE: 35, dividendYield: 0, estimatedPrice: 98 },
  'NFLX': { name: 'Netflix Inc.', sector: 'Communication Services', industry: 'Streaming', marketCap: 250e9, avgPE: 40, dividendYield: 0, estimatedPrice: 585 },
  'CMCSA': { name: 'Comcast Corporation', sector: 'Communication Services', industry: 'Cable', marketCap: 160e9, avgPE: 10, dividendYield: 3.0, estimatedPrice: 42 },
  'T': { name: 'AT&T Inc.', sector: 'Communication Services', industry: 'Telecom', marketCap: 130e9, avgPE: 8, dividendYield: 6.5, estimatedPrice: 18 },
  'VZ': { name: 'Verizon Communications', sector: 'Communication Services', industry: 'Telecom', marketCap: 170e9, avgPE: 9, dividendYield: 6.5, estimatedPrice: 42 },
  'TMUS': { name: 'T-Mobile US', sector: 'Communication Services', industry: 'Telecom', marketCap: 200e9, avgPE: 22, dividendYield: 1.5, estimatedPrice: 175 },
};

const STOCK_UNIVERSE = Object.keys(STOCK_METADATA);

// Well-known mega-cap symbols to exclude for "hidden gems"
const MEGA_CAP_SYMBOLS = new Set([
  'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'NVDA', 'META', 'TSLA', 'JPM', 'JNJ',
  'V', 'UNH', 'XOM', 'PG', 'MA', 'HD', 'CVX', 'LLY', 'ABBV', 'MRK', 'PEP', 'KO',
  'COST', 'WMT', 'BAC', 'PFE', 'NFLX', 'DIS', 'VZ', 'T', 'CMCSA'
]);

function parseNumber(value: string | number | undefined): number {
  if (value === undefined || value === null || value === 'None' || value === '-') return 0;
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return isNaN(num) ? 0 : num;
}

// Fetch a price quote from Alpha Vantage GLOBAL_QUOTE
async function fetchAlphaVantageQuote(symbol: string, apiKey: string): Promise<any | null> {
  try {
    const url = `${ALPHA_VANTAGE_BASE}?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();

    const gq = data['Global Quote'];
    if (!gq || !gq['05. price']) return null;

    const price = parseFloat(gq['05. price']) || 0;
    const previousClose = parseFloat(gq['08. previous close']) || price;
    const change = parseFloat(gq['09. change']) || 0;
    const changePercentStr = (gq['10. change percent'] || '0').replace('%', '');
    const changePercent = parseFloat(changePercentStr) || 0;

    return {
      close: price,
      open: price,
      high: price,
      low: price,
      volume: parseInt(gq['06. volume']) || 0,
      previousClose,
      change,
      change_p: changePercent,
    };
  } catch (err) {
    return null;
  }
}

// Fetch fundamentals from Alpha Vantage
async function fetchFundamentals(symbols: string[], apiKey: string): Promise<Map<string, AlphaVantageFundamentals>> {
  const results = new Map<string, AlphaVantageFundamentals>();

  for (const symbol of symbols) {
    // Check cache first
    const cached = fundamentalsCache.get(symbol);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      results.set(symbol, cached.data);
      continue;
    }

    try {
      const url = `${ALPHA_VANTAGE_BASE}?function=OVERVIEW&symbol=${symbol}&apikey=${apiKey}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data['Error Message'] || data['Note'] || !data.Symbol) {
        continue; // Skip if rate limited or no data
      }

      const fundamentals: AlphaVantageFundamentals = {
        symbol: data.Symbol,
        peRatio: parseNumber(data.PERatio),
        pegRatio: parseNumber(data.PEGRatio),
        pbRatio: parseNumber(data.PriceToBookRatio),
        roe: parseNumber(data.ReturnOnEquityTTM) * 100,
        profitMargin: parseNumber(data.ProfitMargin) * 100,
        operatingMargin: parseNumber(data.OperatingMarginTTM) * 100,
        dividendYield: parseNumber(data.DividendYield) * 100,
        eps: parseNumber(data.EPS),
        analystTargetPrice: parseNumber(data.AnalystTargetPrice),
        week52High: parseNumber(data['52WeekHigh']),
        week52Low: parseNumber(data['52WeekLow']),
        beta: parseNumber(data.Beta),
        revenueGrowth: parseNumber(data.QuarterlyRevenueGrowthYOY) * 100,
        earningsGrowth: parseNumber(data.QuarterlyEarningsGrowthYOY) * 100,
        priceToSales: parseNumber(data.PriceToSalesRatioTTM),
        evToEbitda: parseNumber(data.EVToEBITDA),
      };

      // Cache the result
      fundamentalsCache.set(symbol, { data: fundamentals, timestamp: Date.now() });
      results.set(symbol, fundamentals);

      // Rate limit: 75 req/min = ~1.25 per second, use 100ms delay to be safe
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (err) {
      console.error(`Failed to fetch fundamentals for ${symbol}:`, err);
    }
  }

  return results;
}

// Calculate buy score based on metrics (enhanced with real data)
function calculateBuyScore(
  dayChangePercent: number,
  pe: number,
  dividendYield: number,
  marketCap: number,
  fundamentals?: AlphaVantageFundamentals,
  currentPrice?: number
): number {
  let score = 50;

  // === VALUATION METRICS (35 points max) ===

  // P/E Ratio (15 points max)
  const effectivePE = fundamentals?.peRatio || pe;
  if (effectivePE > 0 && effectivePE < 12) score += 15;
  else if (effectivePE > 0 && effectivePE < 18) score += 10;
  else if (effectivePE > 0 && effectivePE < 25) score += 5;
  else if (effectivePE > 50) score -= 10;

  // PEG Ratio - growth-adjusted P/E (10 points max)
  if (fundamentals?.pegRatio) {
    if (fundamentals.pegRatio > 0 && fundamentals.pegRatio < 1) score += 10;
    else if (fundamentals.pegRatio > 0 && fundamentals.pegRatio < 1.5) score += 6;
    else if (fundamentals.pegRatio > 0 && fundamentals.pegRatio < 2) score += 3;
    else if (fundamentals.pegRatio > 3) score -= 5;
  }

  // P/B Ratio (5 points max)
  if (fundamentals?.pbRatio) {
    if (fundamentals.pbRatio > 0 && fundamentals.pbRatio < 1.5) score += 5;
    else if (fundamentals.pbRatio > 0 && fundamentals.pbRatio < 3) score += 3;
    else if (fundamentals.pbRatio > 10) score -= 3;
  }

  // Price to Sales (5 points max)
  if (fundamentals?.priceToSales) {
    if (fundamentals.priceToSales > 0 && fundamentals.priceToSales < 2) score += 5;
    else if (fundamentals.priceToSales > 0 && fundamentals.priceToSales < 5) score += 2;
    else if (fundamentals.priceToSales > 15) score -= 3;
  }

  // === PROFITABILITY METRICS (20 points max) ===

  // ROE - Return on Equity (10 points max)
  if (fundamentals?.roe) {
    if (fundamentals.roe > 25) score += 10;
    else if (fundamentals.roe > 15) score += 7;
    else if (fundamentals.roe > 10) score += 4;
    else if (fundamentals.roe < 0) score -= 5;
  }

  // Profit Margin (10 points max)
  if (fundamentals?.profitMargin) {
    if (fundamentals.profitMargin > 20) score += 10;
    else if (fundamentals.profitMargin > 10) score += 6;
    else if (fundamentals.profitMargin > 5) score += 3;
    else if (fundamentals.profitMargin < 0) score -= 5;
  }

  // === GROWTH METRICS (10 points max) ===

  // Earnings Growth (5 points max)
  if (fundamentals?.earningsGrowth) {
    if (fundamentals.earningsGrowth > 25) score += 5;
    else if (fundamentals.earningsGrowth > 10) score += 3;
    else if (fundamentals.earningsGrowth < -10) score -= 3;
  }

  // Revenue Growth (5 points max)
  if (fundamentals?.revenueGrowth) {
    if (fundamentals.revenueGrowth > 20) score += 5;
    else if (fundamentals.revenueGrowth > 10) score += 3;
    else if (fundamentals.revenueGrowth < -5) score -= 2;
  }

  // === INCOME (10 points max) ===

  // Dividend Yield
  const effectiveDividend = fundamentals?.dividendYield || dividendYield;
  if (effectiveDividend > 4) score += 10;
  else if (effectiveDividend > 2.5) score += 6;
  else if (effectiveDividend > 1.5) score += 3;

  // === ANALYST/TECHNICAL (15 points max) ===

  // Analyst Target vs Current Price (10 points max)
  if (fundamentals?.analystTargetPrice && currentPrice && currentPrice > 0) {
    const upside = ((fundamentals.analystTargetPrice - currentPrice) / currentPrice) * 100;
    if (upside > 30) score += 10;
    else if (upside > 20) score += 7;
    else if (upside > 10) score += 4;
    else if (upside < -10) score -= 5;
  }

  // 52-Week Position (5 points max) - prefer stocks near 52-week low
  if (fundamentals?.week52High && fundamentals?.week52Low && currentPrice) {
    const range = fundamentals.week52High - fundamentals.week52Low;
    if (range > 0) {
      const position = (currentPrice - fundamentals.week52Low) / range;
      if (position < 0.3) score += 5; // Near 52-week low - potential opportunity
      else if (position < 0.5) score += 3;
      else if (position > 0.9) score -= 2; // Near 52-week high - less upside
    }
  }

  // === MOMENTUM (5 points max) ===

  // Day momentum (contrarian - buy dips)
  if (dayChangePercent < -3) score += 5;
  else if (dayChangePercent < -1) score += 3;
  else if (dayChangePercent > 5) score -= 3;

  // === SIZE FACTOR (5 points max) ===

  // Smaller companies have more growth potential
  if (marketCap < 10e9) score += 5;
  else if (marketCap < 30e9) score += 3;
  else if (marketCap < 50e9) score += 2;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function getRating(score: number): 'strong_buy' | 'buy' | 'hold' | 'sell' {
  if (score >= 75) return 'strong_buy';
  if (score >= 60) return 'buy';
  if (score >= 45) return 'hold';
  return 'sell';
}

function getMarketCapCategory(marketCap: number): string {
  if (marketCap >= 200e9) return 'Mega Cap';
  if (marketCap >= 10e9) return 'Large Cap';
  if (marketCap >= 2e9) return 'Mid Cap';
  if (marketCap >= 300e6) return 'Small Cap';
  return 'Micro Cap';
}

function generateReasons(stock: Partial<ProcessedStock>): string[] {
  const reasons: string[] = [];
  if (stock.pe && stock.pe > 0 && stock.pe < 15) reasons.push(`Low P/E ratio of ${stock.pe.toFixed(1)}`);
  if (stock.dividendYield && stock.dividendYield > 3) reasons.push(`Strong ${stock.dividendYield.toFixed(1)}% dividend yield`);
  if (stock.dayChangePercent && stock.dayChangePercent < -2) reasons.push(`Down ${Math.abs(stock.dayChangePercent).toFixed(1)}% today - potential buying opportunity`);
  if (stock.marketCapCategory === 'Mid Cap' || stock.marketCapCategory === 'Small Cap') reasons.push('Smaller cap with growth potential');
  if (stock.upside && stock.upside > 15) reasons.push(`${stock.upside.toFixed(0)}% upside potential`);
  return reasons.slice(0, 4);
}

function generateRisks(stock: Partial<ProcessedStock>): string[] {
  const risks: string[] = [];
  if (stock.pe && stock.pe > 40) risks.push(`High valuation (P/E: ${stock.pe.toFixed(1)})`);
  if (stock.pe && stock.pe < 0) risks.push('Currently unprofitable');
  if (stock.dayChangePercent && stock.dayChangePercent < -5) risks.push('Significant single-day decline');
  if (stock.marketCapCategory === 'Small Cap') risks.push('Smaller company - higher volatility');
  return risks.slice(0, 3);
}

// Enhanced reason generation with real fundamentals
function generateReasonsEnhanced(stock: Partial<ProcessedStock>, fundamentals?: AlphaVantageFundamentals): string[] {
  const reasons: string[] = [];

  // Valuation reasons
  if (stock.pe && stock.pe > 0 && stock.pe < 15) {
    reasons.push(`Low P/E of ${stock.pe.toFixed(1)} indicates attractive valuation`);
  }
  if (fundamentals?.pegRatio && fundamentals.pegRatio > 0 && fundamentals.pegRatio < 1) {
    reasons.push(`PEG ratio of ${fundamentals.pegRatio.toFixed(2)} suggests undervalued relative to growth`);
  }
  if (fundamentals?.pbRatio && fundamentals.pbRatio > 0 && fundamentals.pbRatio < 2) {
    reasons.push(`P/B ratio of ${fundamentals.pbRatio.toFixed(1)} - trading near book value`);
  }

  // Profitability reasons
  if (fundamentals?.roe && fundamentals.roe > 20) {
    reasons.push(`Strong ROE of ${fundamentals.roe.toFixed(1)}% shows efficient capital use`);
  }
  if (fundamentals?.profitMargin && fundamentals.profitMargin > 15) {
    reasons.push(`High profit margin of ${fundamentals.profitMargin.toFixed(1)}%`);
  }

  // Growth reasons
  if (fundamentals?.earningsGrowth && fundamentals.earningsGrowth > 15) {
    reasons.push(`Earnings growing ${fundamentals.earningsGrowth.toFixed(0)}% YoY`);
  }
  if (fundamentals?.revenueGrowth && fundamentals.revenueGrowth > 10) {
    reasons.push(`Revenue growing ${fundamentals.revenueGrowth.toFixed(0)}% YoY`);
  }

  // Income & analyst reasons
  if (stock.dividendYield && stock.dividendYield > 3) {
    reasons.push(`${stock.dividendYield.toFixed(1)}% dividend yield`);
  }
  if (stock.upside && stock.upside > 20 && fundamentals?.analystTargetPrice) {
    reasons.push(`${stock.upside.toFixed(0)}% upside to analyst target of $${fundamentals.analystTargetPrice.toFixed(0)}`);
  }

  // Technical reasons
  if (stock.dayChangePercent && stock.dayChangePercent < -3) {
    reasons.push(`Down ${Math.abs(stock.dayChangePercent).toFixed(1)}% - potential dip buying opportunity`);
  }
  if (stock.below52WeekHigh && stock.below52WeekHigh > 20) {
    reasons.push(`${stock.below52WeekHigh.toFixed(0)}% below 52-week high`);
  }

  // Size factor
  if (stock.marketCapCategory === 'Mid Cap' || stock.marketCapCategory === 'Small Cap') {
    reasons.push('Smaller cap with growth potential');
  }

  return reasons.slice(0, 5);
}

// Enhanced risk generation with real fundamentals
function generateRisksEnhanced(stock: Partial<ProcessedStock>, fundamentals?: AlphaVantageFundamentals): string[] {
  const risks: string[] = [];

  // Valuation risks
  if (stock.pe && stock.pe > 50) {
    risks.push(`High P/E of ${stock.pe.toFixed(1)} - expensive valuation`);
  }
  if (stock.pe && stock.pe < 0) {
    risks.push('Currently unprofitable');
  }
  if (fundamentals?.pegRatio && fundamentals.pegRatio > 2.5) {
    risks.push(`High PEG of ${fundamentals.pegRatio.toFixed(1)} - may be overvalued`);
  }

  // Profitability risks
  if (fundamentals?.profitMargin && fundamentals.profitMargin < 5 && fundamentals.profitMargin > 0) {
    risks.push(`Thin profit margin of ${fundamentals.profitMargin.toFixed(1)}%`);
  }
  if (fundamentals?.roe && fundamentals.roe < 5 && fundamentals.roe > 0) {
    risks.push(`Low ROE of ${fundamentals.roe.toFixed(1)}% - weak capital efficiency`);
  }

  // Growth risks
  if (fundamentals?.earningsGrowth && fundamentals.earningsGrowth < -10) {
    risks.push(`Earnings declining ${Math.abs(fundamentals.earningsGrowth).toFixed(0)}% YoY`);
  }
  if (fundamentals?.revenueGrowth && fundamentals.revenueGrowth < -5) {
    risks.push(`Revenue declining ${Math.abs(fundamentals.revenueGrowth).toFixed(0)}% YoY`);
  }

  // Technical risks
  if (stock.dayChangePercent && stock.dayChangePercent < -7) {
    risks.push('Significant price drop - investigate cause');
  }
  if (stock.above52WeekLow && stock.above52WeekLow < 5) {
    risks.push('Trading near 52-week low - potential distress');
  }

  // Volatility risk
  if (fundamentals?.beta && fundamentals.beta > 1.5) {
    risks.push(`High beta of ${fundamentals.beta.toFixed(2)} - elevated volatility`);
  }

  // Size risk
  if (stock.marketCapCategory === 'Small Cap' || stock.marketCapCategory === 'Micro Cap') {
    risks.push('Smaller company - higher volatility and risk');
  }

  return risks.slice(0, 4);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const minMarketCap = parseInt(searchParams.get('minMarketCap') || '0');
    const maxMarketCap = parseInt(searchParams.get('maxMarketCap') || '10000000000000');
    const sector = searchParams.get('sector') || '';
    const limit = parseInt(searchParams.get('limit') || '100');
    const sortBy = searchParams.get('sortBy') || 'buyScore';
    const hiddenGems = searchParams.get('hiddenGems') === 'true';
    const debug = searchParams.get('debug') === 'true';

    const alphaVantageKey = request.headers.get('x-alphavantage-key') ||
      process.env.ALPHA_VANTAGE_API_KEY ||
      process.env.NEXT_PUBLIC_ALPHA_VANTAGE_KEY ||
      process.env.ALPHA_VANTAGE_KEY;

    if (!alphaVantageKey) {
      return NextResponse.json({
        success: false,
        error: 'Alpha Vantage API key not configured. Please add your Alpha Vantage API key in Settings.',
        requiresSetup: true,
      }, { status: 503 });
    }

    const processedStocks: ProcessedStock[] = [];
    const debugInfo: { errors: string[]; responses: any[]; usingEstimatedPrices: number; fundamentalsFetched: number } = { errors: [], responses: [], usingEstimatedPrices: 0, fundamentalsFetched: 0 };

    // Step 1: Collect preliminary stock data with price quotes
    interface PreliminaryStock {
      symbol: string;
      quote: any;
      metadata: typeof STOCK_METADATA[string];
      currentPrice: number;
      dayChange: number;
      dayChangePercent: number;
    }
    const preliminaryStocks: PreliminaryStock[] = [];

    // Fetch price quotes via Alpha Vantage GLOBAL_QUOTE in batches
    const batchSize = 5; // Alpha Vantage has stricter rate limits
    for (let i = 0; i < STOCK_UNIVERSE.length; i += batchSize) {
      const batch = STOCK_UNIVERSE.slice(i, i + batchSize);

      const promises = batch.map(async (symbol) => {
        try {
          let quote = await fetchAlphaVantageQuote(symbol, alphaVantageKey);

          if (debug && debugInfo.responses.length < 3) {
            debugInfo.responses.push({ symbol, source: quote ? 'alphavantage' : 'estimated', quote });
          }

          // If API failed, use estimated price as fallback
          if (!quote) {
            const meta = STOCK_METADATA[symbol];
            if (meta?.estimatedPrice) {
              quote = {
                close: meta.estimatedPrice,
                open: meta.estimatedPrice,
                high: meta.estimatedPrice * 1.02,
                low: meta.estimatedPrice * 0.98,
                volume: 0,
                previousClose: meta.estimatedPrice,
                change: 0,
                change_p: 0,
                isEstimated: true,
              };
              debugInfo.errors.push(`${symbol}: Using estimated price (API unavailable)`);
            } else {
              debugInfo.errors.push(`${symbol}: No data from any endpoint`);
              return null;
            }
          }

          return { symbol, quote };
        } catch (err) {
          // On error, try to use estimated price
          const meta = STOCK_METADATA[symbol];
          if (meta?.estimatedPrice) {
            return {
              symbol,
              quote: {
                close: meta.estimatedPrice,
                open: meta.estimatedPrice,
                high: meta.estimatedPrice * 1.02,
                low: meta.estimatedPrice * 0.98,
                volume: 0,
                previousClose: meta.estimatedPrice,
                change: 0,
                change_p: 0,
                isEstimated: true,
              },
            };
          }
          debugInfo.errors.push(`${symbol}: ${err instanceof Error ? err.message : 'Unknown error'}`);
          return null;
        }
      });

      const results = await Promise.all(promises);

      for (const result of results) {
        if (!result) continue;

        const { symbol, quote } = result;
        const metadata = STOCK_METADATA[symbol];
        if (!metadata) continue;

        if ((quote as any).isEstimated) {
          debugInfo.usingEstimatedPrices++;
        }

        const marketCap = metadata.marketCap;

        // Apply filters early
        if (marketCap < minMarketCap || marketCap > maxMarketCap) continue;
        if (sector && !metadata.sector.toLowerCase().includes(sector.toLowerCase())) continue;
        if (hiddenGems && MEGA_CAP_SYMBOLS.has(symbol)) continue;
        if (hiddenGems && marketCap > 100e9) continue;

        const currentPrice = quote.close;
        const dayChange = quote.change || (currentPrice - quote.previousClose);
        const dayChangePercent = quote.change_p || ((dayChange / quote.previousClose) * 100);

        preliminaryStocks.push({
          symbol,
          quote,
          metadata,
          currentPrice,
          dayChange,
          dayChangePercent,
        });
      }

      // Rate limit delay between batches
      if (i + batchSize < STOCK_UNIVERSE.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    // Step 2: Fetch fundamentals from Alpha Vantage
    let fundamentalsMap = new Map<string, AlphaVantageFundamentals>();
    if (alphaVantageKey && preliminaryStocks.length > 0) {
      // Fetch fundamentals for filtered stocks (limit to top candidates to save API calls)
      const symbolsToFetch = preliminaryStocks.map(s => s.symbol);
      fundamentalsMap = await fetchFundamentals(symbolsToFetch, alphaVantageKey);
      debugInfo.fundamentalsFetched = fundamentalsMap.size;
    }

    // Step 3: Create final processed stocks with real fundamentals
    for (const prelim of preliminaryStocks) {
      const { symbol, quote, metadata, currentPrice, dayChange, dayChangePercent } = prelim;
      const fundamentals = fundamentalsMap.get(symbol);

      // Calculate target price from analyst data or estimate
      let targetPrice = currentPrice * 1.15; // Default 15% upside estimate
      let upside = 15;
      if (fundamentals?.analystTargetPrice && fundamentals.analystTargetPrice > 0) {
        targetPrice = fundamentals.analystTargetPrice;
        upside = ((targetPrice - currentPrice) / currentPrice) * 100;
      }

      // Calculate 52-week metrics
      let below52WeekHigh = 0;
      let above52WeekLow = 0;
      if (fundamentals?.week52High && fundamentals?.week52Low) {
        below52WeekHigh = ((fundamentals.week52High - currentPrice) / fundamentals.week52High) * 100;
        above52WeekLow = ((currentPrice - fundamentals.week52Low) / fundamentals.week52Low) * 100;
      }

      // Determine valuation status based on P/E
      const effectivePE = fundamentals?.peRatio || metadata.avgPE;
      const valuationStatus: 'undervalued' | 'fair' | 'overvalued' =
        effectivePE > 0 && effectivePE < 15 ? 'undervalued' :
        effectivePE > 30 ? 'overvalued' : 'fair';

      // Calculate buy score with real fundamentals
      const buyScore = calculateBuyScore(
        dayChangePercent,
        metadata.avgPE,
        metadata.dividendYield,
        metadata.marketCap,
        fundamentals,
        currentPrice
      );

      const stock: ProcessedStock = {
        symbol,
        name: metadata.name,
        sector: metadata.sector,
        industry: metadata.industry,
        currentPrice,
        targetPrice,
        fairValue: targetPrice,
        upside,
        buyScore,
        rating: getRating(buyScore),
        confidence: fundamentals ? Math.min(95, 60 + buyScore / 3) : Math.min(75, 45 + buyScore / 3),
        marketCap: metadata.marketCap,
        marketCapCategory: getMarketCapCategory(metadata.marketCap),
        pe: fundamentals?.peRatio || metadata.avgPE,
        pbRatio: fundamentals?.pbRatio || 0,
        roe: fundamentals?.roe || 0,
        profitMargin: fundamentals?.profitMargin || 0,
        dividendYield: fundamentals?.dividendYield || metadata.dividendYield,
        priceToSales: fundamentals?.priceToSales || 0,
        dayChange,
        dayChangePercent,
        volume: quote.volume || 0,
        dayHigh: quote.high || currentPrice,
        dayLow: quote.low || currentPrice,
        below52WeekHigh,
        above52WeekLow,
        reasonsToConsider: [],
        risks: [],
        valuationStatus,
        discountToFairValue: upside > 0 ? upside : 0,
      };

      // Generate reasons with real data
      stock.reasonsToConsider = generateReasonsEnhanced(stock, fundamentals);
      stock.risks = generateRisksEnhanced(stock, fundamentals);

      processedStocks.push(stock);
    }

    // Sort
    processedStocks.sort((a, b) => {
      if (sortBy === 'upside') return b.upside - a.upside;
      if (sortBy === 'discount') return b.discountToFairValue - a.discountToFairValue;
      return b.buyScore - a.buyScore;
    });

    const finalStocks = processedStocks.slice(0, limit);

    const sectorBreakdown: Record<string, number> = {};
    for (const stock of finalStocks) {
      sectorBreakdown[stock.sector] = (sectorBreakdown[stock.sector] || 0) + 1;
    }

    return NextResponse.json({
      success: true,
      data: {
        stocks: finalStocks,
        totalScreened: STOCK_UNIVERSE.length,
        totalProcessed: processedStocks.length,
        usingEstimatedPrices: debugInfo.usingEstimatedPrices > 0,
        estimatedPricesCount: debugInfo.usingEstimatedPrices,
        fundamentalsEnabled: !!alphaVantageKey,
        fundamentalsFetched: debugInfo.fundamentalsFetched,
        filters: { minMarketCap, maxMarketCap, sector, hiddenGems, sortBy },
        sectorBreakdown,
        generatedAt: new Date().toISOString(),
        debug: debug ? {
          alphaVantageKeyPresent: !!alphaVantageKey,
          apiKeyLength: alphaVantageKey?.length || 0,
          sampleErrors: debugInfo.errors.slice(0, 10),
          sampleResponses: debugInfo.responses,
          totalErrors: debugInfo.errors.length,
          usingEstimatedPrices: debugInfo.usingEstimatedPrices,
          fundamentalsFetched: debugInfo.fundamentalsFetched,
        } : undefined,
      },
    });

  } catch (error) {
    console.error('Screener error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to screen stocks',
    }, { status: 500 });
  }
}
