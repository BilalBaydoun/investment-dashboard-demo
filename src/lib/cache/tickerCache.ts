import fs from 'fs';
import path from 'path';

// Cache configuration (in milliseconds)
const CACHE_CONFIG = {
  quote: 30 * 60 * 1000,        // 30 minutes for real-time quotes
  history_1D: 2 * 60 * 60 * 1000,   // 2 hours for 1D/1W historical
  history_1W: 2 * 60 * 60 * 1000,
  history_1M: 12 * 60 * 60 * 1000,  // 12 hours for 1M historical
  history_3M: 24 * 60 * 60 * 1000,  // 24 hours for 3M+ historical
  history_default: 24 * 60 * 60 * 1000, // 24 hours default
};

// Cache directory
const CACHE_DIR = path.join(process.cwd(), '.ticker-cache');

// Ensure cache directory exists
function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

// Get cache file path for a ticker
function getCacheFilePath(symbol: string, type: 'quote' | 'history', range?: string): string {
  const filename = type === 'quote'
    ? `${symbol.toUpperCase()}_quote.json`
    : `${symbol.toUpperCase()}_history_${range || 'default'}.json`;
  return path.join(CACHE_DIR, filename);
}

// Get TTL based on data type and range
function getTTL(type: 'quote' | 'history', range?: string): number {
  if (type === 'quote') return CACHE_CONFIG.quote;

  switch (range) {
    case '1D': return CACHE_CONFIG.history_1D;
    case '1W': return CACHE_CONFIG.history_1W;
    case '1M': return CACHE_CONFIG.history_1M;
    case '3M':
    case '6M':
    case '1Y':
    case 'YTD':
    case 'ALL':
      return CACHE_CONFIG.history_3M;
    default:
      return CACHE_CONFIG.history_default;
  }
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  symbol: string;
  type: string;
  range?: string;
}

// Get cached data
export function getCachedData<T>(symbol: string, type: 'quote' | 'history', range?: string): T | null {
  try {
    ensureCacheDir();
    const filePath = getCacheFilePath(symbol, type, range);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const cacheEntry: CacheEntry<T> = JSON.parse(fileContent);

    const ttl = getTTL(type, range);
    const now = Date.now();

    // Check if cache is still valid
    if (now - cacheEntry.timestamp < ttl) {
      console.log(`[Cache HIT] ${symbol} ${type}${range ? ` (${range})` : ''}`);
      return cacheEntry.data;
    }

    console.log(`[Cache EXPIRED] ${symbol} ${type}${range ? ` (${range})` : ''}`);
    return null;
  } catch (error) {
    console.error('Cache read error:', error);
    return null;
  }
}

// Set cached data
export function setCachedData<T>(symbol: string, type: 'quote' | 'history', data: T, range?: string): void {
  try {
    ensureCacheDir();
    const filePath = getCacheFilePath(symbol, type, range);

    const cacheEntry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      symbol: symbol.toUpperCase(),
      type,
      range,
    };

    fs.writeFileSync(filePath, JSON.stringify(cacheEntry, null, 2));
    console.log(`[Cache SET] ${symbol} ${type}${range ? ` (${range})` : ''}`);
  } catch (error) {
    console.error('Cache write error:', error);
  }
}

// Clear cache for a specific symbol
export function clearCache(symbol?: string): void {
  try {
    ensureCacheDir();

    if (symbol) {
      // Clear specific symbol cache
      const files = fs.readdirSync(CACHE_DIR);
      const symbolUpper = symbol.toUpperCase();
      files.forEach(file => {
        if (file.startsWith(symbolUpper)) {
          fs.unlinkSync(path.join(CACHE_DIR, file));
        }
      });
      console.log(`[Cache CLEARED] ${symbol}`);
    } else {
      // Clear all cache
      const files = fs.readdirSync(CACHE_DIR);
      files.forEach(file => {
        fs.unlinkSync(path.join(CACHE_DIR, file));
      });
      console.log('[Cache CLEARED] All');
    }
  } catch (error) {
    console.error('Cache clear error:', error);
  }
}

// Get cache stats
export function getCacheStats(): { totalFiles: number; totalSize: number; entries: string[] } {
  try {
    ensureCacheDir();
    const files = fs.readdirSync(CACHE_DIR);
    let totalSize = 0;

    files.forEach(file => {
      const stats = fs.statSync(path.join(CACHE_DIR, file));
      totalSize += stats.size;
    });

    return {
      totalFiles: files.length,
      totalSize,
      entries: files,
    };
  } catch (error) {
    return { totalFiles: 0, totalSize: 0, entries: [] };
  }
}

// Batch get cached quotes for multiple symbols
export function getCachedQuotes(symbols: string[]): Record<string, any> {
  const cached: Record<string, any> = {};
  const missing: string[] = [];

  symbols.forEach(symbol => {
    const data = getCachedData(symbol, 'quote');
    if (data) {
      cached[symbol] = data;
    } else {
      missing.push(symbol);
    }
  });

  return cached;
}

// Get symbols that need to be fetched (not in cache or expired)
export function getMissingSymbols(symbols: string[]): string[] {
  return symbols.filter(symbol => !getCachedData(symbol, 'quote'));
}
