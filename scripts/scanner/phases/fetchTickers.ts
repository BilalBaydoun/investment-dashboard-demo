import { fetchListingStatus } from '../lib/alphaVantage';
import type { Ticker } from '../lib/types';

export async function fetchAllTickers(): Promise<Ticker[]> {
  console.log('Phase 1: Fetching all US tickers via LISTING_STATUS...');

  const csv = await fetchListingStatus();
  const lines = csv.trim().split('\n');

  // First line is header: symbol,name,exchange,assetType,ipoDate,delistingDate,status
  const tickers: Ticker[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 6) continue;

    const [symbol, name, exchange, assetType, ipoDate, , status] = cols;

    // Only active stocks (not ETFs, warrants, etc.)
    if (status?.trim() !== 'Active') continue;
    if (assetType?.trim() !== 'Stock') continue;

    // Skip OTC/pink sheets - focus on major exchanges
    const ex = exchange?.trim();
    if (!ex || ex === 'OTC' || ex === 'PINK') continue;

    // Skip symbols with special characters (warrants, units, etc.)
    const sym = symbol?.trim();
    if (!sym || sym.includes('-') || sym.includes('.') || sym.length > 5) continue;

    tickers.push({
      symbol: sym,
      name: name?.trim() || sym,
      exchange: ex,
      assetType: assetType?.trim(),
      ipoDate: ipoDate?.trim(),
      status: 'Active',
    });
  }

  console.log(`Phase 1 complete: Found ${tickers.length} active US stocks`);
  return tickers;
}
