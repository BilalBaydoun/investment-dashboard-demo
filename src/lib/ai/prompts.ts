import type { Position, Quote, TechnicalIndicators, NewsItem } from '@/types';

// Helper function to safely format numbers
function formatNumber(value: number | string | undefined, decimals: number = 2): string {
  const num = Number(value);
  return isNaN(num) ? '0.00' : num.toFixed(decimals);
}

// Screener data passed from AI Picks page for rating consistency
interface ScreenerData {
  buyScore: number;  // 0-100 fundamental score
  rating: string;    // strong_buy, buy, hold, sell
  pe?: number;
  dividendYield?: number;
}

// The technicals parameter can be either old flat format or new Alpha Vantage nested format
export function generateAnalysisPrompt(
  symbol: string,
  quote: Quote,
  technicals: TechnicalIndicators | any | null,
  news: NewsItem[],
  screenerData?: ScreenerData
): string {
  const newsContext = news.slice(0, 5).map(n => `- ${n.title} (${n.sentiment})`).join('\n');

  // Build screener context if available
  const screenerContext = screenerData ? `
### Pre-Analysis Fundamental Score (from Stock Screener):
- Fundamental Buy Score: ${screenerData.buyScore}/100
- Screener Rating: ${screenerData.rating.replace('_', ' ').toUpperCase()}
${screenerData.pe ? `- P/E Ratio: ${screenerData.pe}` : ''}
${screenerData.dividendYield ? `- Dividend Yield: ${screenerData.dividendYield}%` : ''}

**IMPORTANT**: The screener has already rated this stock as "${screenerData.rating.replace('_', ' ').toUpperCase()}" based on fundamental analysis.
Your final rating should be consistent with this unless technical indicators or recent news strongly suggest otherwise.
Rating guidelines: strong_buy (score ≥75), buy (score ≥60), hold (score ≥45), sell (score <45).
` : '';

  return `You are a professional investment analyst. Analyze the following asset and provide actionable insights.

## Asset: ${symbol} (${quote.name})

### Current Market Data:
- Current Price: $${formatNumber(quote.price)}
- Daily Change: ${formatNumber(quote.changePercent)}%
- Previous Close: $${formatNumber(quote.previousClose)}
- Today's Range: $${formatNumber(quote.low)} - $${formatNumber(quote.high)}
- 52-Week Range: $${formatNumber(quote.fiftyTwoWeekLow)} - $${formatNumber(quote.fiftyTwoWeekHigh)}
- Volume: ${Number(quote.volume || 0).toLocaleString()}
${quote.marketCap ? `- Market Cap: $${formatNumber(Number(quote.marketCap) / 1e9)}B` : ''}
${quote.peRatio ? `- P/E Ratio: ${formatNumber(quote.peRatio)}` : ''}
${screenerContext}
${technicals ? `### Technical Indicators (from Alpha Vantage):
- RSI (14): ${formatNumber(technicals.indicators?.rsi?.value || technicals.rsi)} ${Number(technicals.indicators?.rsi?.value || technicals.rsi) > 70 ? '(Overbought)' : Number(technicals.indicators?.rsi?.value || technicals.rsi) < 30 ? '(Oversold)' : '(Neutral)'}
- MACD: ${formatNumber(technicals.indicators?.macd?.macd || technicals.macd?.value)} (Signal: ${formatNumber(technicals.indicators?.macd?.signal || technicals.macd?.signal)}) [${technicals.indicators?.macd?.trend || 'N/A'}]
- SMA 20: $${formatNumber(technicals.indicators?.sma?.sma20 || technicals.sma20)}
- SMA 50: $${formatNumber(technicals.indicators?.sma?.sma50 || technicals.sma50)}
- SMA 200: $${formatNumber(technicals.indicators?.sma?.sma200 || technicals.sma200)}
- EMA 12: $${formatNumber(technicals.indicators?.ema?.ema12)}
- EMA 26: $${formatNumber(technicals.indicators?.ema?.ema26)}
- Bollinger Bands: Lower $${formatNumber(technicals.indicators?.bollingerBands?.lower || technicals.bollingerBands?.lower)} | Middle $${formatNumber(technicals.indicators?.bollingerBands?.middle || technicals.bollingerBands?.middle)} | Upper $${formatNumber(technicals.indicators?.bollingerBands?.upper || technicals.bollingerBands?.upper)}
- Stochastic: K=${formatNumber(technicals.indicators?.stochastic?.k)} D=${formatNumber(technicals.indicators?.stochastic?.d)} [${technicals.indicators?.stochastic?.signal || 'N/A'}]
- ADX: ${formatNumber(technicals.indicators?.adx?.value)} [${technicals.indicators?.adx?.trend || 'N/A'} trend]
- ATR (Volatility): ${formatNumber(technicals.indicators?.atr?.value)}
- Technical Summary: Score ${technicals.summary?.technicalScore || 'N/A'}/10 - ${technicals.summary?.overallSignal || 'N/A'} (${technicals.summary?.bullishSignals || 0} bullish, ${technicals.summary?.bearishSignals || 0} bearish signals)` : ''}

${news.length > 0 ? `### Recent News:
${newsContext}` : ''}

### Required Analysis:
1. **Signal**: Provide a clear BUY, SELL, or HOLD recommendation
2. **Confidence Level**: Rate your overall confidence 1-100
3. **Technical Score**: Rate the technical setup 1-10
4. **Sentiment Score**: Rate market sentiment based on news 1-10 (1=very bearish, 10=very bullish)
5. **Entry Price**: Suggested entry price if buying
6. **Target Price**: Price target for 3-6 month horizon
7. **Stop Loss**: Recommended stop loss level
8. **Risk Level**: LOW, MEDIUM, or HIGH
9. **Key Patterns**: Identify any chart patterns
10. **Support Levels**: Key support price levels
11. **Resistance Levels**: Key resistance price levels
12. **Reasoning**: 2-3 sentences explaining your analysis
13. **News Summary**: Brief summary of news sentiment and key headlines

Respond in JSON format:
{
  "action": "buy" | "sell" | "hold" | "strong_buy" | "strong_sell",
  "confidence": number,
  "technicalScore": number,
  "sentimentScore": number,
  "entryPrice": number,
  "targetPrice": number,
  "stopLoss": number,
  "riskLevel": "low" | "medium" | "high",
  "patterns": string[],
  "supportLevels": number[],
  "resistanceLevels": number[],
  "reasoning": string,
  "newsSummary": string
}`;
}

// Comprehensive analysis using all Alpha Vantage data
export function generateComprehensiveAnalysisPrompt(
  symbol: string,
  fundamentals: any,
  fairValue: any,
  earnings: any,
  news: NewsItem[]
): string {
  // Format news with full context
  const newsContext = news.slice(0, 10).map((n, i) =>
    `${i + 1}. "${n.title}" - ${n.source} (${n.sentiment || 'unknown'} sentiment)
   ${n.description ? `   Summary: ${n.description.slice(0, 200)}...` : ''}`
  ).join('\n');

  // Format earnings history
  const earningsHistory = earnings?.history?.slice(0, 8).map((e: any) =>
    `   Q${new Date(e.fiscalDateEnding).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}: ` +
    `Est $${formatNumber(e.estimatedEPS)} → Actual $${formatNumber(e.reportedEPS)} ` +
    `(${e.beat ? '✓ BEAT' : '✗ MISS'} by ${formatNumber(e.surprisePercentage)}%)`
  ).join('\n') || 'No earnings history available';

  // Format fair value estimates
  const fairValueMethods = fairValue?.estimates?.map((e: any) =>
    `   - ${e.method}: $${formatNumber(e.value)} (${e.description})`
  ).join('\n') || 'No fair value estimates';

  return `You are a Senior Portfolio Manager and CFA with a Master's in Finance.
Analyze this stock comprehensively using all provided data. Be specific with numbers and provide actionable insights.

═══════════════════════════════════════════════════════════════
                    STOCK ANALYSIS: ${symbol}
═══════════════════════════════════════════════════════════════

## COMPANY PROFILE
• Name: ${fundamentals?.name || symbol}
• Sector: ${fundamentals?.sector || 'N/A'}
• Industry: ${fundamentals?.industry || 'N/A'}
• Market Cap: $${fundamentals?.marketCap ? formatNumber(fundamentals.marketCap / 1e9) + 'B' : 'N/A'}

## CURRENT VALUATION METRICS
• Current Price: ~$${formatNumber(fundamentals?.day50MA || 0)} (50-day MA proxy)
• P/E Ratio (TTM): ${formatNumber(fundamentals?.peRatio)}
• Forward P/E: ${formatNumber(fundamentals?.forwardPE)}
• PEG Ratio: ${formatNumber(fundamentals?.pegRatio)}
• Price/Book: ${formatNumber(fundamentals?.priceToBook)}
• Price/Sales: ${formatNumber(fundamentals?.priceToSales)}
• EV/EBITDA: ${formatNumber(fundamentals?.evToEbitda)}

## FAIR VALUE ANALYSIS
Average Fair Value: $${formatNumber(fairValue?.average || 0)}
Current vs Fair Value: ${fairValue?.upside > 0 ? '+' : ''}${formatNumber(fairValue?.upside || 0)}% ${fairValue?.upside > 15 ? '(UNDERVALUED)' : fairValue?.upside < -15 ? '(OVERVALUED)' : '(FAIRLY VALUED)'}

Valuation Methods:
${fairValueMethods}

## PROFITABILITY & EFFICIENCY
• EPS (TTM): $${formatNumber(fundamentals?.eps)}
• Revenue (TTM): $${fundamentals?.revenueTTM ? formatNumber(fundamentals.revenueTTM / 1e9) + 'B' : 'N/A'}
• Profit Margin: ${formatNumber(fundamentals?.profitMargin)}%
• Operating Margin: ${formatNumber(fundamentals?.operatingMargin)}%
• Return on Equity: ${formatNumber(fundamentals?.returnOnEquity)}%
• Return on Assets: ${formatNumber(fundamentals?.returnOnAssets)}%

## GROWTH METRICS
• Quarterly Revenue Growth (YoY): ${formatNumber(fundamentals?.quarterlyRevenueGrowth)}%
• Quarterly Earnings Growth (YoY): ${formatNumber(fundamentals?.quarterlyEarningsGrowth)}%

## EARNINGS TRACK RECORD
Beat Rate: ${formatNumber(earnings?.beatRate || 0)}% (last ${earnings?.history?.length || 0} quarters)
Average Surprise: ${earnings?.avgSurprise > 0 ? '+' : ''}${formatNumber(earnings?.avgSurprise || 0)}%

Recent Earnings History:
${earningsHistory}

Next Earnings: ${earnings?.nextDate || 'TBD'}
${earnings?.nextEstimate ? `Expected EPS: $${formatNumber(earnings.nextEstimate)}` : ''}

## ANALYST CONSENSUS
• Target Price: $${formatNumber(fundamentals?.analystTargetPrice)}
• Strong Buy: ${fundamentals?.analystRatingStrongBuy || 0}
• Buy: ${fundamentals?.analystRatingBuy || 0}
• Hold: ${fundamentals?.analystRatingHold || 0}
• Sell: ${fundamentals?.analystRatingSell || 0}
• Strong Sell: ${fundamentals?.analystRatingStrongSell || 0}

## DIVIDEND INFO
• Dividend Yield: ${formatNumber(fundamentals?.dividendYield)}%
• Payout Ratio: ${formatNumber(fundamentals?.payoutRatio)}%
• Ex-Dividend Date: ${fundamentals?.exDividendDate || 'N/A'}

## TECHNICAL LEVELS
• 52-Week High: $${formatNumber(fundamentals?.week52High)}
• 52-Week Low: $${formatNumber(fundamentals?.week52Low)}
• 50-Day MA: $${formatNumber(fundamentals?.day50MA)}
• 200-Day MA: $${formatNumber(fundamentals?.day200MA)}
• Beta: ${formatNumber(fundamentals?.beta)}

## OWNERSHIP & SHORT INTEREST
• Insider Ownership: ${formatNumber(fundamentals?.percentInsiders)}%
• Institutional Ownership: ${formatNumber(fundamentals?.percentInstitutions)}%
• Short % of Float: ${formatNumber(fundamentals?.shortPercentFloat)}%
• Short Ratio (Days to Cover): ${formatNumber(fundamentals?.shortRatio)}

## RECENT NEWS & SENTIMENT (${news.length} articles)
${newsContext || 'No recent news available'}

═══════════════════════════════════════════════════════════════
                    YOUR ANALYSIS REQUIRED
═══════════════════════════════════════════════════════════════

Based on ALL the above data, provide your professional analysis:

1. **Investment Thesis**: What's the core story for this stock?
2. **Valuation Assessment**: Is it cheap, fair, or expensive? Why?
3. **Earnings Quality**: How reliable and sustainable are earnings?
4. **Risk Factors**: What could go wrong?
5. **News Sentiment**: What's the market narrative saying?
6. **Technical Setup**: Current positioning vs key levels
7. **Final Recommendation**: Clear action with conviction level

Respond in JSON:
{
  "action": "strong_buy" | "buy" | "hold" | "sell" | "strong_sell",
  "confidence": number (1-100),
  "technicalScore": number (1-10),
  "sentimentScore": number (1-10, based on news analysis),
  "entryPrice": number,
  "targetPrice": number,
  "stopLoss": number,
  "riskLevel": "low" | "medium" | "high",
  "patterns": string[],
  "supportLevels": number[],
  "resistanceLevels": number[],
  "analysis": {
    "summary": "1-2 sentence executive summary of your recommendation",
    "valuation": "2-3 sentences on valuation assessment with specific numbers",
    "growth": "2-3 sentences on growth prospects and earnings quality",
    "risks": "2-3 sentences on key risk factors",
    "technicals": "1-2 sentences on technical setup and key levels",
    "catalyst": "1 sentence on near-term catalyst or trigger"
  },
  "reasoning": "Brief 1-2 sentence overall conclusion",
  "newsSummary": "2-3 sentence summary of news sentiment and key themes"
}`;
}

export function generatePortfolioAnalysisPrompt(
  positions: Position[],
  totalValue: number,
  totalCost: number
): string {
  const totalVal = Number(totalValue) || 0;
  const totalCst = Number(totalCost) || 0;
  const totalGain = totalVal - totalCst;
  const totalGainPercent = totalCst > 0 ? ((totalVal - totalCst) / totalCst) * 100 : 0;

  // Calculate allocation percentages
  const positionDetails = positions.map(p => {
    const qty = Number(p.quantity) || 0;
    const currentPrice = Number(p.currentPrice) || 0;
    const avgCost = Number(p.avgCost) || 0;
    const value = qty * currentPrice;
    const allocation = totalVal > 0 ? (value / totalVal) * 100 : 0;
    const gainPercent = avgCost > 0 ? ((currentPrice - avgCost) / avgCost) * 100 : 0;
    return `- ${p.symbol} (${p.assetType}): Value $${formatNumber(value)} | Allocation: ${formatNumber(allocation)}% | P&L: ${gainPercent >= 0 ? '+' : ''}${formatNumber(gainPercent)}%`;
  }).join('\n');

  // Calculate asset class breakdown
  const assetClasses: Record<string, number> = {};
  positions.forEach(p => {
    const value = (Number(p.currentPrice) || 0) * (Number(p.quantity) || 0);
    const type = p.assetType || 'stock';
    assetClasses[type] = (assetClasses[type] || 0) + value;
  });

  const assetBreakdown = Object.entries(assetClasses)
    .map(([type, value]) => `- ${type}: $${formatNumber(value)} (${formatNumber((value / totalVal) * 100)}%)`)
    .join('\n');

  return `You are a professional portfolio manager and investment advisor. Analyze this portfolio thoroughly and provide actionable optimization recommendations.

## PORTFOLIO SUMMARY
- Total Value: $${formatNumber(totalVal)}
- Total Cost: $${formatNumber(totalCst)}
- Total P&L: ${totalGainPercent >= 0 ? '+' : ''}${formatNumber(totalGainPercent)}% ($${formatNumber(totalGain)})
- Number of Holdings: ${positions.length}

## ASSET CLASS BREAKDOWN
${assetBreakdown}

## INDIVIDUAL HOLDINGS
${positionDetails}

## YOUR ANALYSIS TASKS

1. **Diversification Score (1-10)**: Evaluate sector, asset class, and geographic diversification
2. **Risk Score (1-10)**: Higher = more risky. Consider volatility, concentration, and correlation
3. **Sharpe Ratio**: Estimate based on portfolio composition (typical range 0.5-2.5)

4. **Recommendations** (provide exactly 5):
   - Be specific and actionable
   - Reference actual holdings by symbol
   - Include percentage allocations where relevant
   - Consider current market conditions
   - Suggest NEW stocks/ETFs to consider that aren't in the portfolio

5. **Rebalancing Suggestions**: For each holding AND 2-3 new recommendations:
   - "amount" field must be a simple integer between -50 and +50 representing percentage POINTS to change
   - Example: If AAPL is at 30% and should be 20%, amount = -10 (reduce by 10 percentage points)
   - For new stocks to add, use "increase" action with a suggested allocation amount

IMPORTANT RULES FOR AMOUNTS:
- NEVER use values larger than 50 or smaller than -50
- amount = -10 means "reduce allocation by 10 percentage points"
- amount = +15 means "increase allocation by 15 percentage points"
- For new stock suggestions not in portfolio, set currentAllocation to 0

Respond ONLY with valid JSON in this exact format:
{
  "diversificationScore": 7,
  "riskScore": 6,
  "sharpeRatio": 1.2,
  "recommendations": [
    "Consider reducing UBER position from 54% to under 25% to reduce concentration risk",
    "Add exposure to international markets through VEU or VXUS ETF (suggest 10% allocation)",
    "Your bond allocation is low - consider adding BND or AGG for stability",
    "Take partial profits on positions with gains over 50%",
    "Consider adding defensive sectors like utilities (XLU) or healthcare (XLV)"
  ],
  "rebalanceSuggestions": [
    {"symbol": "UBER", "currentAllocation": 54, "targetAllocation": 25, "action": "decrease", "amount": -29, "reason": "Reduce concentration risk - single position exceeds 50%"},
    {"symbol": "VEU", "currentAllocation": 0, "targetAllocation": 10, "action": "increase", "amount": 10, "reason": "Add international diversification"},
    {"symbol": "BND", "currentAllocation": 0, "targetAllocation": 8, "action": "increase", "amount": 8, "reason": "Add bond exposure for portfolio stability"}
  ]
}`;
}

export function generateSentimentPrompt(symbol: string, news: NewsItem[]): string {
  const newsDetails = news.map(n =>
    `Title: ${n.title}\nSource: ${n.source}\nDate: ${n.publishedAt}\nSummary: ${n.description?.slice(0, 200) || 'N/A'}`
  ).join('\n\n');

  return `Analyze the sentiment of these news articles about ${symbol} and provide an overall sentiment assessment.

## News Articles:
${newsDetails}

## Required Analysis:
1. **Overall Sentiment**: BULLISH, BEARISH, or NEUTRAL
2. **Sentiment Score**: -100 (very bearish) to +100 (very bullish)
3. **Key Topics**: Main themes from the news
4. **Impact Assessment**: How might this news affect the stock?

Respond in JSON format:
{
  "overallSentiment": "bullish" | "bearish" | "neutral",
  "sentimentScore": number,
  "keyTopics": string[],
  "impactAssessment": string
}`;
}

export function generateChatPrompt(
  question: string,
  positions: Position[],
  totalValue: number
): string {
  const totalVal = Number(totalValue) || 0;
  const holdings = positions.map(p => {
    const qty = Number(p.quantity) || 0;
    const price = Number(p.currentPrice) || 0;
    const pct = totalVal > 0 ? ((qty * price / totalVal) * 100) : 0;
    return `${p.symbol}: ${qty} units @ $${formatNumber(price)} (${formatNumber(pct, 1)}% of portfolio)`;
  }).join('\n');

  return `You are a helpful investment advisor assistant. Answer the user's question based on their portfolio context.

## User's Portfolio:
Total Value: $${formatNumber(totalVal)}

Holdings:
${holdings}

## User Question:
${question}

## Guidelines:
- Provide clear, actionable advice
- Consider the user's current holdings when making recommendations
- Always remind that this is not financial advice
- Be specific with numbers when possible
- If suggesting changes, explain the reasoning

Provide a helpful, conversational response.`;
}

export const AI_DISCLAIMER = `
**Disclaimer**: This analysis is generated by AI and is for informational purposes only.
It should not be considered as financial advice. Always conduct your own research and
consider consulting with a qualified financial advisor before making investment decisions.
Past performance does not guarantee future results.
`;
