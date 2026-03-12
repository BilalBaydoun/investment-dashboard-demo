import { fetchAllTickers } from './phases/fetchTickers';
import { screenFundamentals, MEGA_CAP_SYMBOLS } from './phases/fundamentals';
import { deepTechnicals } from './phases/technicals';
import type { WeeklyAnalysis, SectorBreakdown, ScoredStock } from './lib/types';
import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_FILE = path.join(__dirname, '../..', 'data', 'weekly-analysis.json');
const isTest = process.argv.includes('--test');

async function main() {
  const startTime = Date.now();

  console.log('='.repeat(60));
  console.log('  Weekly Stock Scanner Agent');
  console.log(`  Started: ${new Date().toISOString()}`);
  if (isTest) console.log('  MODE: TEST (limited to 20 tickers)');
  console.log('='.repeat(60));

  // Validate API key
  if (!process.env.ALPHA_VANTAGE_KEY) {
    console.error('ERROR: ALPHA_VANTAGE_KEY environment variable is required');
    process.exit(1);
  }

  // Phase 1: Fetch all tickers
  let tickers = await fetchAllTickers();

  if (isTest) {
    // In test mode, only scan a small subset
    tickers = tickers.slice(0, 20);
    console.log(`Test mode: limited to ${tickers.length} tickers`);
  }

  const totalTickers = tickers.length;

  // Phase 2: Fundamentals screening
  const topN = isTest ? 10 : 300;
  const { candidates } = await screenFundamentals(tickers, topN);

  // Phase 3: Deep technical analysis
  const analyzed = await deepTechnicals(candidates);

  // Build output
  const topPicks = analyzed
    .filter(s => s.rating === 'strong_buy' || s.rating === 'buy')
    .slice(0, 50);

  const hiddenGems = analyzed
    .filter(s => !MEGA_CAP_SYMBOLS.has(s.symbol) && s.marketCap < 100e9)
    .sort((a, b) => b.buyScore - a.buyScore)
    .slice(0, 50);

  // Sector breakdown
  const sectorMap = new Map<string, ScoredStock[]>();
  for (const stock of analyzed) {
    const existing = sectorMap.get(stock.sector) || [];
    existing.push(stock);
    sectorMap.set(stock.sector, existing);
  }

  const sectorBreakdown: Record<string, SectorBreakdown> = {};
  for (const [sector, stocks] of sectorMap) {
    const avgScore = stocks.reduce((sum, s) => sum + s.buyScore, 0) / stocks.length;
    const topPick = stocks.sort((a, b) => b.buyScore - a.buyScore)[0];
    sectorBreakdown[sector] = {
      count: stocks.length,
      avgScore: Math.round(avgScore),
      topPick: topPick.symbol,
      topPickScore: topPick.buyScore,
    };
  }

  const durationMinutes = Math.round((Date.now() - startTime) / 1000 / 60);

  const output: WeeklyAnalysis = {
    generatedAt: new Date().toISOString(),
    scanDurationMinutes: durationMinutes,
    totalTickersScanned: totalTickers,
    totalCandidatesAnalyzed: analyzed.length,
    topPicks,
    hiddenGems,
    sectorBreakdown,
    allAnalyzed: analyzed,
  };

  // Write output
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log('');
  console.log('='.repeat(60));
  console.log('  Scan Complete!');
  console.log(`  Duration: ${durationMinutes} minutes`);
  console.log(`  Tickers scanned: ${totalTickers}`);
  console.log(`  Candidates analyzed: ${analyzed.length}`);
  console.log(`  Top picks: ${topPicks.length}`);
  console.log(`  Hidden gems: ${hiddenGems.length}`);
  console.log(`  Sectors covered: ${Object.keys(sectorBreakdown).length}`);
  console.log(`  Output: ${OUTPUT_FILE}`);
  console.log('='.repeat(60));
}

main().catch(err => {
  console.error('Scanner failed:', err);
  process.exit(1);
});
