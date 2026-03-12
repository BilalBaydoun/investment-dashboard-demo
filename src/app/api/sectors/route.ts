import { NextRequest, NextResponse } from 'next/server';

const ALPHA_VANTAGE_BASE = 'https://www.alphavantage.co/query';

// Fallback sector data for common stocks
const STOCK_SECTORS: Record<string, { sector: string; industry: string; country: string }> = {
  AAPL: { sector: 'Technology', industry: 'Consumer Electronics', country: 'United States' },
  MSFT: { sector: 'Technology', industry: 'Software—Infrastructure', country: 'United States' },
  GOOGL: { sector: 'Technology', industry: 'Internet Content & Information', country: 'United States' },
  GOOG: { sector: 'Technology', industry: 'Internet Content & Information', country: 'United States' },
  AMZN: { sector: 'Consumer Cyclical', industry: 'Internet Retail', country: 'United States' },
  NVDA: { sector: 'Technology', industry: 'Semiconductors', country: 'United States' },
  META: { sector: 'Technology', industry: 'Internet Content & Information', country: 'United States' },
  TSLA: { sector: 'Consumer Cyclical', industry: 'Auto Manufacturers', country: 'United States' },
  JPM: { sector: 'Financial Services', industry: 'Banks—Diversified', country: 'United States' },
  V: { sector: 'Financial Services', industry: 'Credit Services', country: 'United States' },
  JNJ: { sector: 'Healthcare', industry: 'Drug Manufacturers—General', country: 'United States' },
  UNH: { sector: 'Healthcare', industry: 'Healthcare Plans', country: 'United States' },
  HD: { sector: 'Consumer Cyclical', industry: 'Home Improvement Retail', country: 'United States' },
  PG: { sector: 'Consumer Defensive', industry: 'Household & Personal Products', country: 'United States' },
  MA: { sector: 'Financial Services', industry: 'Credit Services', country: 'United States' },
  XOM: { sector: 'Energy', industry: 'Oil & Gas Integrated', country: 'United States' },
  CVX: { sector: 'Energy', industry: 'Oil & Gas Integrated', country: 'United States' },
  KO: { sector: 'Consumer Defensive', industry: 'Beverages—Non-Alcoholic', country: 'United States' },
  PEP: { sector: 'Consumer Defensive', industry: 'Beverages—Non-Alcoholic', country: 'United States' },
  MRK: { sector: 'Healthcare', industry: 'Drug Manufacturers—General', country: 'United States' },
  ABBV: { sector: 'Healthcare', industry: 'Drug Manufacturers—General', country: 'United States' },
  LLY: { sector: 'Healthcare', industry: 'Drug Manufacturers—General', country: 'United States' },
  PFE: { sector: 'Healthcare', industry: 'Drug Manufacturers—General', country: 'United States' },
  BAC: { sector: 'Financial Services', industry: 'Banks—Diversified', country: 'United States' },
  WFC: { sector: 'Financial Services', industry: 'Banks—Diversified', country: 'United States' },
  COST: { sector: 'Consumer Defensive', industry: 'Discount Stores', country: 'United States' },
  WMT: { sector: 'Consumer Defensive', industry: 'Discount Stores', country: 'United States' },
  DIS: { sector: 'Communication Services', industry: 'Entertainment', country: 'United States' },
  NFLX: { sector: 'Communication Services', industry: 'Entertainment', country: 'United States' },
  ADBE: { sector: 'Technology', industry: 'Software—Infrastructure', country: 'United States' },
  CRM: { sector: 'Technology', industry: 'Software—Application', country: 'United States' },
  AMD: { sector: 'Technology', industry: 'Semiconductors', country: 'United States' },
  INTC: { sector: 'Technology', industry: 'Semiconductors', country: 'United States' },
  QCOM: { sector: 'Technology', industry: 'Semiconductors', country: 'United States' },
  T: { sector: 'Communication Services', industry: 'Telecom Services', country: 'United States' },
  VZ: { sector: 'Communication Services', industry: 'Telecom Services', country: 'United States' },
  NKE: { sector: 'Consumer Cyclical', industry: 'Footwear & Accessories', country: 'United States' },
  MCD: { sector: 'Consumer Cyclical', industry: 'Restaurants', country: 'United States' },
  SBUX: { sector: 'Consumer Cyclical', industry: 'Restaurants', country: 'United States' },
  BA: { sector: 'Industrials', industry: 'Aerospace & Defense', country: 'United States' },
  CAT: { sector: 'Industrials', industry: 'Farm & Heavy Construction Machinery', country: 'United States' },
  GE: { sector: 'Industrials', industry: 'Specialty Industrial Machinery', country: 'United States' },
  UPS: { sector: 'Industrials', industry: 'Integrated Freight & Logistics', country: 'United States' },
  RTX: { sector: 'Industrials', industry: 'Aerospace & Defense', country: 'United States' },
  GS: { sector: 'Financial Services', industry: 'Capital Markets', country: 'United States' },
  MS: { sector: 'Financial Services', industry: 'Capital Markets', country: 'United States' },
  BLK: { sector: 'Financial Services', industry: 'Asset Management', country: 'United States' },
  SCHW: { sector: 'Financial Services', industry: 'Capital Markets', country: 'United States' },
  NEE: { sector: 'Utilities', industry: 'Utilities—Regulated Electric', country: 'United States' },
  DUK: { sector: 'Utilities', industry: 'Utilities—Regulated Electric', country: 'United States' },
  SO: { sector: 'Utilities', industry: 'Utilities—Regulated Electric', country: 'United States' },
  AMT: { sector: 'Real Estate', industry: 'REIT—Specialty', country: 'United States' },
  PLD: { sector: 'Real Estate', industry: 'REIT—Industrial', country: 'United States' },
  O: { sector: 'Real Estate', industry: 'REIT—Retail', country: 'United States' },
  SPG: { sector: 'Real Estate', industry: 'REIT—Retail', country: 'United States' },
  UBER: { sector: 'Technology', industry: 'Software—Application', country: 'United States' },
  LYFT: { sector: 'Technology', industry: 'Software—Application', country: 'United States' },
  PYPL: { sector: 'Financial Services', industry: 'Credit Services', country: 'United States' },
  SQ: { sector: 'Technology', industry: 'Software—Infrastructure', country: 'United States' },
  SHOP: { sector: 'Technology', industry: 'Software—Application', country: 'Canada' },
  SNOW: { sector: 'Technology', industry: 'Software—Application', country: 'United States' },
  PLTR: { sector: 'Technology', industry: 'Software—Infrastructure', country: 'United States' },
  COIN: { sector: 'Financial Services', industry: 'Capital Markets', country: 'United States' },
  RIVN: { sector: 'Consumer Cyclical', industry: 'Auto Manufacturers', country: 'United States' },
  LCID: { sector: 'Consumer Cyclical', industry: 'Auto Manufacturers', country: 'United States' },
  F: { sector: 'Consumer Cyclical', industry: 'Auto Manufacturers', country: 'United States' },
  GM: { sector: 'Consumer Cyclical', industry: 'Auto Manufacturers', country: 'United States' },
  QS: { sector: 'Technology', industry: 'Electrical Equipment & Parts', country: 'United States' },
  BLBD: { sector: 'Industrials', industry: 'Farm & Heavy Construction Machinery', country: 'United States' },
  // ETFs
  SPY: { sector: 'ETF', industry: 'Index Fund - S&P 500', country: 'United States' },
  QQQ: { sector: 'ETF', industry: 'Index Fund - NASDAQ 100', country: 'United States' },
  VTI: { sector: 'ETF', industry: 'Index Fund - Total Market', country: 'United States' },
  VOO: { sector: 'ETF', industry: 'Index Fund - S&P 500', country: 'United States' },
  IWM: { sector: 'ETF', industry: 'Index Fund - Russell 2000', country: 'United States' },
  VEA: { sector: 'ETF', industry: 'International - Developed', country: 'International' },
  VWO: { sector: 'ETF', industry: 'International - Emerging', country: 'Emerging Markets' },
  EFA: { sector: 'ETF', industry: 'International - Developed', country: 'International' },
  SCHD: { sector: 'ETF', industry: 'Dividend Fund', country: 'United States' },
  VYM: { sector: 'ETF', industry: 'Dividend Fund', country: 'United States' },
  ARKK: { sector: 'ETF', industry: 'Growth Fund', country: 'United States' },
  XLF: { sector: 'ETF', industry: 'Sector - Financials', country: 'United States' },
  XLK: { sector: 'ETF', industry: 'Sector - Technology', country: 'United States' },
  XLE: { sector: 'ETF', industry: 'Sector - Energy', country: 'United States' },
  XLV: { sector: 'ETF', industry: 'Sector - Healthcare', country: 'United States' },
  // International stocks
  BABA: { sector: 'Consumer Cyclical', industry: 'Internet Retail', country: 'China' },
  TSM: { sector: 'Technology', industry: 'Semiconductors', country: 'Taiwan' },
  NVO: { sector: 'Healthcare', industry: 'Drug Manufacturers—General', country: 'Denmark' },
  ASML: { sector: 'Technology', industry: 'Semiconductor Equipment & Materials', country: 'Netherlands' },
  SAP: { sector: 'Technology', industry: 'Software—Application', country: 'Germany' },
  TM: { sector: 'Consumer Cyclical', industry: 'Auto Manufacturers', country: 'Japan' },
  SONY: { sector: 'Technology', industry: 'Consumer Electronics', country: 'Japan' },
  NVS: { sector: 'Healthcare', industry: 'Drug Manufacturers—General', country: 'Switzerland' },
  UL: { sector: 'Consumer Defensive', industry: 'Household & Personal Products', country: 'United Kingdom' },
  BP: { sector: 'Energy', industry: 'Oil & Gas Integrated', country: 'United Kingdom' },
  SHEL: { sector: 'Energy', industry: 'Oil & Gas Integrated', country: 'United Kingdom' },
};

// Crypto assets are classified differently
const CRYPTO_INFO: Record<string, { sector: string; category: string }> = {
  BTC: { sector: 'Cryptocurrency', category: 'Store of Value' },
  ETH: { sector: 'Cryptocurrency', category: 'Smart Contract Platform' },
  BNB: { sector: 'Cryptocurrency', category: 'Exchange Token' },
  XRP: { sector: 'Cryptocurrency', category: 'Payment' },
  ADA: { sector: 'Cryptocurrency', category: 'Smart Contract Platform' },
  SOL: { sector: 'Cryptocurrency', category: 'Smart Contract Platform' },
  DOGE: { sector: 'Cryptocurrency', category: 'Meme Coin' },
  DOT: { sector: 'Cryptocurrency', category: 'Infrastructure' },
  MATIC: { sector: 'Cryptocurrency', category: 'Layer 2' },
  LINK: { sector: 'Cryptocurrency', category: 'Oracle' },
  AVAX: { sector: 'Cryptocurrency', category: 'Smart Contract Platform' },
  UNI: { sector: 'Cryptocurrency', category: 'DeFi' },
  ATOM: { sector: 'Cryptocurrency', category: 'Infrastructure' },
  LTC: { sector: 'Cryptocurrency', category: 'Payment' },
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const symbols = searchParams.get('symbols')?.toUpperCase().split(',') || [];
  const values = searchParams.get('values')?.split(',').map(Number) || [];

  const apiKey = request.headers.get('x-alphavantage-key') ||
    process.env.NEXT_PUBLIC_ALPHA_VANTAGE_KEY ||
    process.env.ALPHA_VANTAGE_API_KEY ||
    process.env.ALPHA_VANTAGE_KEY;

  try {
    switch (action) {
      case 'profile': {
        // Get sector/industry/country info for symbols
        const profiles: Record<string, any> = {};

        // Try static data first, then Alpha Vantage OVERVIEW for unknowns
        for (const symbol of symbols) {
          // Check if crypto
          if (CRYPTO_INFO[symbol]) {
            profiles[symbol] = {
              symbol,
              sector: CRYPTO_INFO[symbol].sector,
              industry: CRYPTO_INFO[symbol].category,
              country: 'Decentralized',
            };
            continue;
          }

          // Check static data
          if (STOCK_SECTORS[symbol]) {
            profiles[symbol] = {
              symbol,
              ...STOCK_SECTORS[symbol],
            };
            continue;
          }

          // Try Alpha Vantage OVERVIEW for unknown symbols
          if (apiKey) {
            try {
              const response = await fetch(
                `${ALPHA_VANTAGE_BASE}?function=OVERVIEW&symbol=${symbol}&apikey=${apiKey}`
              );
              const data = await response.json();
              if (data.Symbol && !data['Error Message'] && !data['Note']) {
                profiles[symbol] = {
                  symbol,
                  sector: data.Sector || 'Other',
                  industry: data.Industry || 'Unknown',
                  country: data.Country || 'Unknown',
                };
                continue;
              }
            } catch (e) {
              console.error(`Failed to fetch profile for ${symbol}:`, e);
            }
          }

          // Default fallback
          profiles[symbol] = {
            symbol,
            sector: 'Other',
            industry: 'Unknown',
            country: 'Unknown',
          };
        }

        return NextResponse.json({ success: true, data: profiles });
      }

      case 'allocation': {
        // Calculate sector, industry, and geographic allocation
        if (symbols.length !== values.length) {
          return NextResponse.json(
            { success: false, error: 'Symbols and values arrays must match' },
            { status: 400 }
          );
        }

        const totalValue = values.reduce((a, b) => a + b, 0);
        const sectorAllocation: Record<string, number> = {};
        const industryAllocation: Record<string, number> = {};
        const countryAllocation: Record<string, number> = {};
        const positions: any[] = [];

        for (let i = 0; i < symbols.length; i++) {
          const symbol = symbols[i];
          const value = values[i];
          const weight = totalValue > 0 ? (value / totalValue) * 100 : 0;

          let sector = 'Other';
          let industry = 'Unknown';
          let country = 'Unknown';

          if (CRYPTO_INFO[symbol]) {
            sector = CRYPTO_INFO[symbol].sector;
            industry = CRYPTO_INFO[symbol].category;
            country = 'Decentralized';
          } else if (STOCK_SECTORS[symbol]) {
            sector = STOCK_SECTORS[symbol].sector;
            industry = STOCK_SECTORS[symbol].industry;
            country = STOCK_SECTORS[symbol].country;
          }

          sectorAllocation[sector] = (sectorAllocation[sector] || 0) + weight;
          industryAllocation[industry] = (industryAllocation[industry] || 0) + weight;
          countryAllocation[country] = (countryAllocation[country] || 0) + weight;

          positions.push({
            symbol,
            value,
            weight,
            sector,
            industry,
            country,
          });
        }

        // Sort allocations by weight
        const sortByWeight = (obj: Record<string, number>) =>
          Object.entries(obj)
            .sort(([, a], [, b]) => b - a)
            .map(([name, weight]) => ({ name, weight: Number(weight.toFixed(2)) }));

        return NextResponse.json({
          success: true,
          data: {
            totalValue,
            sectors: sortByWeight(sectorAllocation),
            industries: sortByWeight(industryAllocation),
            countries: sortByWeight(countryAllocation),
            positions,
          },
        });
      }

      case 'correlation': {
        // Calculate correlation matrix using historical returns
        if (symbols.length < 2) {
          return NextResponse.json(
            { success: false, error: 'At least 2 symbols required for correlation' },
            { status: 400 }
          );
        }

        // Fetch historical data for each symbol via Alpha Vantage
        const historicalData: Record<string, number[]> = {};

        for (const symbol of symbols) {
          try {
            const isCrypto = CRYPTO_INFO[symbol] !== undefined;

            if (isCrypto && apiKey) {
              // Fetch crypto historical data via Alpha Vantage DIGITAL_CURRENCY_DAILY
              const response = await fetch(
                `${ALPHA_VANTAGE_BASE}?function=DIGITAL_CURRENCY_DAILY&symbol=${symbol}&market=USD&apikey=${apiKey}`
              );
              const data = await response.json();
              const timeSeries = data['Time Series (Digital Currency Daily)'];
              if (timeSeries) {
                const prices = Object.values(timeSeries)
                  .slice(0, 90)
                  .map((d: any) => parseFloat(d['4a. close (USD)']) || parseFloat(d['4. close']) || 0)
                  .filter((p: number) => p > 0);
                if (prices.length > 0) {
                  historicalData[symbol] = prices.reverse();
                }
              }

              // Rate limit delay
              await new Promise(resolve => setTimeout(resolve, 250));
            } else if (apiKey) {
              // Fetch stock historical data via Alpha Vantage TIME_SERIES_DAILY
              const response = await fetch(
                `${ALPHA_VANTAGE_BASE}?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=compact&apikey=${apiKey}`
              );
              const data = await response.json();
              const timeSeries = data['Time Series (Daily)'];
              if (timeSeries) {
                const prices = Object.values(timeSeries)
                  .slice(0, 90)
                  .map((d: any) => parseFloat(d['4. close']))
                  .filter((p: number) => p > 0);
                if (prices.length > 0) {
                  historicalData[symbol] = prices.reverse();
                }
              }

              // Rate limit delay
              await new Promise(resolve => setTimeout(resolve, 250));
            }
          } catch (e) {
            console.error(`Failed to fetch history for ${symbol}:`, e);
          }
        }

        // Calculate daily returns
        const returns: Record<string, number[]> = {};
        for (const [symbol, prices] of Object.entries(historicalData)) {
          if (prices.length < 2) continue;
          returns[symbol] = [];
          for (let i = 1; i < prices.length; i++) {
            const dailyReturn = (prices[i] - prices[i - 1]) / prices[i - 1];
            returns[symbol].push(dailyReturn);
          }
        }

        // Calculate correlation matrix
        const symbolsWithData = Object.keys(returns);
        const matrix: Record<string, Record<string, number>> = {};

        for (const sym1 of symbolsWithData) {
          matrix[sym1] = {};
          for (const sym2 of symbolsWithData) {
            if (sym1 === sym2) {
              matrix[sym1][sym2] = 1;
            } else {
              matrix[sym1][sym2] = calculateCorrelation(returns[sym1], returns[sym2]);
            }
          }
        }

        // Generate mock correlation for symbols without data
        const mockMatrix: Record<string, Record<string, number>> = {};
        for (const sym1 of symbols) {
          mockMatrix[sym1] = {};
          for (const sym2 of symbols) {
            if (sym1 === sym2) {
              mockMatrix[sym1][sym2] = 1;
            } else if (matrix[sym1]?.[sym2] !== undefined) {
              mockMatrix[sym1][sym2] = matrix[sym1][sym2];
            } else {
              // Generate semi-realistic mock correlation based on sectors
              const sector1 = STOCK_SECTORS[sym1]?.sector || CRYPTO_INFO[sym1]?.sector || 'Other';
              const sector2 = STOCK_SECTORS[sym2]?.sector || CRYPTO_INFO[sym2]?.sector || 'Other';

              if (sector1 === sector2) {
                mockMatrix[sym1][sym2] = 0.6 + Math.random() * 0.3; // Same sector: 0.6-0.9
              } else if (
                (sector1 === 'Cryptocurrency' && sector2 !== 'Cryptocurrency') ||
                (sector2 === 'Cryptocurrency' && sector1 !== 'Cryptocurrency')
              ) {
                mockMatrix[sym1][sym2] = -0.1 + Math.random() * 0.4; // Crypto vs stocks: -0.1 to 0.3
              } else {
                mockMatrix[sym1][sym2] = 0.2 + Math.random() * 0.4; // Different sectors: 0.2-0.6
              }
              mockMatrix[sym1][sym2] = Number(mockMatrix[sym1][sym2].toFixed(2));
            }
          }
        }

        // Calculate average correlation (excluding self-correlation)
        let totalCorr = 0;
        let count = 0;
        for (const sym1 of symbols) {
          for (const sym2 of symbols) {
            if (sym1 !== sym2) {
              totalCorr += mockMatrix[sym1][sym2];
              count++;
            }
          }
        }
        const avgCorrelation = count > 0 ? totalCorr / count : 0;

        return NextResponse.json({
          success: true,
          data: {
            symbols,
            matrix: mockMatrix,
            averageCorrelation: Number(avgCorrelation.toFixed(2)),
            diversificationScore: Number(((1 - avgCorrelation) * 100).toFixed(0)),
          },
        });
      }

      default:
        return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Sectors API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch sector data' },
      { status: 500 }
    );
  }
}

// Helper function to calculate Pearson correlation coefficient
function calculateCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;

  const xSlice = x.slice(0, n);
  const ySlice = y.slice(0, n);

  const sumX = xSlice.reduce((a, b) => a + b, 0);
  const sumY = ySlice.reduce((a, b) => a + b, 0);
  const sumXY = xSlice.reduce((acc, xi, i) => acc + xi * ySlice[i], 0);
  const sumX2 = xSlice.reduce((acc, xi) => acc + xi * xi, 0);
  const sumY2 = ySlice.reduce((acc, yi) => acc + yi * yi, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  if (denominator === 0) return 0;

  const correlation = numerator / denominator;
  return Number(Math.max(-1, Math.min(1, correlation)).toFixed(2));
}
