# InvestAI Dashboard

An AI-powered investment portfolio dashboard built with Next.js, React, and TypeScript. Track your investments, get intelligent buy/sell signals, and receive personalized recommendations to achieve your financial goals.

> **Note:** This repo includes demo portfolio data (AAPL, MSFT, NVDA, etc.) so the dashboard is populated out of the box. To use with live data, add your own API keys in `.env.local`.

## Features

### Portfolio Management
- Track stocks, crypto, ETFs, bonds, and real estate
- Add/edit/remove positions with transaction history
- Real-time portfolio value and P&L calculations
- Multiple portfolio support
- Export/import functionality

### Market Data (Alpha Vantage)
- Real-time stock quotes
- Cryptocurrency prices
- Interactive price charts with multiple timeframes
- Technical indicators (RSI, MACD, Moving Averages, Bollinger Bands, Stochastic, ADX, ATR)
- Financial news with sentiment analysis
- Commodity prices (Gold, Silver, Platinum, Palladium)

### AI-Powered Analysis (OpenAI)
- Buy/sell signal generation with confidence scores
- Portfolio optimization recommendations
- News sentiment analysis
- Interactive AI chat for investment questions
- Risk assessment and diversification scoring

### Weekly Stock Scanner Agent (Planned)
- Automated weekly scan of all ~6,000 US stocks
- Phase 1: Fetch all tickers via LISTING_STATUS endpoint
- Phase 2: Fundamentals screen via OVERVIEW (~80 min at 75 calls/min)
- Phase 3: Deep technical analysis on top 300 candidates (~40 min)
- Results cached locally for instant dashboard loading
- Buy/sell recommendations with confidence scores
- Hidden gems detection (undervalued mid/small caps)
- Sector breakdown and week-over-week changes

### Dashboard Widgets
- Portfolio value with time-based changes
- Asset allocation pie chart
- Top movers (gainers/losers)
- Performance vs S&P 500 benchmark
- Market Fear & Greed Index
- Goal tracking
- Recent transactions

### Watchlist
- Track potential investments
- Set price alerts
- Quick AI analysis access
- Notes and target prices

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **State Management**: Zustand
- **Charts**: Recharts
- **AI**: OpenAI GPT-4
- **Market Data**: Alpha Vantage (stocks, crypto, news, technicals, fundamentals)
- **Sentiment**: Alternative.me Fear & Greed Index (free, no key)

## API Architecture

The dashboard uses only 3 external services:

| Service | Purpose | Key Required |
|---------|---------|-------------|
| **Alpha Vantage** | Stocks, crypto, news, technicals, fundamentals, commodities | Yes ($49.99/mo recommended) |
| **OpenAI** | AI analysis, chat, recommendations | Yes (pay-per-use) |
| **Alternative.me** | Fear & Greed Index | No (free) |

### Alpha Vantage Endpoints Used
- `GLOBAL_QUOTE` - Real-time stock quotes
- `TIME_SERIES_DAILY` / `TIME_SERIES_INTRADAY` - Historical price data
- `SYMBOL_SEARCH` - Stock/ETF search
- `OVERVIEW` - Company fundamentals (P/E, ROE, margins, analyst targets)
- `INCOME_STATEMENT` / `BALANCE_SHEET` / `CASH_FLOW` - Financial statements
- `EARNINGS` / `EARNINGS_CALENDAR` - Earnings data
- `NEWS_SENTIMENT` - Financial news with sentiment scores
- `LISTING_STATUS` - All US tickers (for weekly scanner)
- `CURRENCY_EXCHANGE_RATE` - Crypto & commodity prices
- `DIGITAL_CURRENCY_DAILY` - Crypto historical data
- `RSI`, `MACD`, `SMA`, `EMA`, `BBANDS`, `STOCH`, `ADX`, `ATR` - 50+ technical indicators

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.local.example .env.local
```

3. Add your API keys to `.env.local`:
```env
NEXT_PUBLIC_ALPHA_VANTAGE_KEY=your_key_here
OPENAI_API_KEY=your_key_here
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000)

## API Keys Setup

### Alpha Vantage (All Market Data)
1. Visit [alphavantage.co](https://www.alphavantage.co/support/#api-key)
2. Free tier: 25 calls/day (for testing)
3. **Recommended**: Basic plan at $49.99/mo (75 calls/min, no daily limit)
4. Covers: stocks, crypto, news, technicals, fundamentals, commodities

### OpenAI (AI Features)
1. Visit [platform.openai.com](https://platform.openai.com/api-keys)
2. Create an account and add payment method
3. Generate an API key

## Weekly Scanner Agent

The planned weekly scanner agent will automatically analyze all US stocks:

### How It Works
1. **Sunday evening**: Agent starts automated scan
2. **Phase 1** (instant): Downloads all ~6,000 US tickers via `LISTING_STATUS`
3. **Phase 2** (~80 min): Fetches fundamentals for each stock via `OVERVIEW` at 75 calls/min
4. **Phase 3** (~40 min): Deep technical analysis (RSI, MACD, SMA, etc.) on top 300 candidates
5. **Output**: `weekly-analysis.json` with ranked recommendations

### Requirements
- Alpha Vantage Basic plan ($49.99/mo) for 75 calls/min
- Total runtime: ~2 hours weekly
- Results cached locally — dashboard loads instantly with zero API calls

### Output Format
- Top 50 "Strong Buy" recommendations
- Top 50 "Hidden Gems" (undervalued mid/small caps)
- Sector breakdown with top picks per sector
- Week-over-week score changes
- New entries and exits from the list

## Project Structure

```
/src
├── /app                    # Next.js App Router
│   ├── /api               # API routes
│   │   ├── /stocks        # Stock quotes, history, technicals (Alpha Vantage)
│   │   ├── /crypto        # Cryptocurrency data (Alpha Vantage)
│   │   ├── /news          # Financial news + sentiment (Alpha Vantage)
│   │   ├── /fundamentals  # Company fundamentals (Alpha Vantage)
│   │   ├── /earnings      # Earnings data (Alpha Vantage)
│   │   ├── /screener      # Stock screener (Alpha Vantage)
│   │   ├── /sentiment     # Fear & Greed Index (Alternative.me)
│   │   ├── /commodities   # Precious metals (Alpha Vantage)
│   │   ├── /dividends     # Dividend tracking (Alpha Vantage + local data)
│   │   ├── /sectors       # Sector allocation (Alpha Vantage + local data)
│   │   ├── /insider       # Insider trading (Yahoo Finance fallback)
│   │   └── /ai            # AI analysis (OpenAI)
│   ├── /(dashboard)       # Dashboard pages
│   └── page.tsx           # Landing page
├── /components
│   ├── /ui                # shadcn components
│   ├── /layout            # Layout components
│   ├── /charts            # Chart components
│   ├── /portfolio         # Portfolio components
│   ├── /dashboard         # Dashboard widgets
│   └── /ai                # AI components
├── /hooks                 # Custom React hooks
├── /store                 # Zustand stores
├── /types                 # TypeScript types
└── /lib
    ├── /api               # API client functions
    └── /ai                # AI prompts & logic
```

## Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Routes

| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/dashboard` | Main portfolio overview |
| `/portfolio` | Manage positions |
| `/analysis` | AI deep analysis |
| `/watchlist` | Track potential buys |
| `/settings` | API keys, preferences |

## Disclaimer

This application is for educational and informational purposes only. It is not intended to be investment advice. Always do your own research and consult with a qualified financial advisor before making investment decisions. Past performance does not guarantee future results.

## License

MIT
