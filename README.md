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
- Cash balance management with deposits/withdrawals
- Historical snapshots and performance tracking

### AI-Powered Deep Analysis
- **Fundamental Score** — Buffett-style 100-point scoring system evaluating profitability, valuation, financial health, growth, analyst consensus, dividends, and 52-week position
- **Fair Value Estimation** — Multiple valuation methods (DCF, Graham, P/E-based, analyst targets) with upside/downside calculation
- **Technical Indicators** — RSI gauge, MACD with histogram, ADX trend strength, SMA (20/50/200), EMA (12/26), Bollinger Bands, Stochastic, ATR — with bullish/bearish signal summary
- **Profitability & Moat Analysis** — ROE, ROA, profit margin, operating margin with quality labels
- **Earnings Tracking** — Beat rate, EPS history, next earnings date, surprise analysis
- **Insider Trades** — Recent buy/sell activity from company insiders
- **Analyst Ratings** — Consensus breakdown (Strong Buy → Strong Sell) with target price
- **Ownership & Short Interest** — Insider %, institutional %, short float, short ratio

### AI Chat & Recommendations (OpenAI)
- Interactive AI chat for investment questions
- Portfolio optimization recommendations
- Buy/sell signal generation with confidence scores
- News sentiment analysis
- Risk assessment and diversification scoring

### Weekly Stock Scanner Agent
An automated GitHub Actions agent that scans the entire US stock market every Sunday:

1. **Phase 1 — Ticker Discovery**: Downloads all ~7,500 active US tickers via Alpha Vantage `LISTING_STATUS`
2. **Phase 2 — Fundamental Screening** (~80 min): Fetches company fundamentals (P/E, ROE, margins, growth, analyst targets) for every ticker at 75 calls/min, scores each stock using a weighted scoring algorithm
3. **Phase 3 — Technical Deep Dive** (~40 min): Runs RSI, MACD, SMA, EMA, ADX, Bollinger Bands, and Stochastic analysis on the top 300 candidates
4. **Output**: Generates `weekly-analysis.json` with ranked recommendations

**What the scanner produces:**
- Top 50 "Strong Buy" stocks with buy scores, target prices, and upside potential
- Top 50 "Hidden Gems" — undervalued mid/small caps not on most radars
- Sector breakdown with top picks per sector
- Detailed scoring breakdown (valuation, growth, profitability, momentum, analyst sentiment)
- Risk flags and reasons to consider for each pick

**How it runs:**
- Triggered automatically via GitHub Actions cron (every Sunday at 11pm UTC)
- Can also be triggered manually from the GitHub Actions UI
- Uses checkpoint/resume so it can recover from interruptions
- Results are committed to the repo and loaded by the dashboard with zero additional API calls

### Dashboard Widgets
- Portfolio value hero with total gain/loss and today's change
- Asset allocation pie chart (stocks, crypto, ETFs, bonds, commodities)
- Performance vs S&P 500 benchmark chart with 24h client-side caching
- Top movers — today's gainers and losers in your portfolio
- Market Fear & Greed Index
- Goal tracking with progress bars
- Recent transactions
- Earnings calendar for upcoming portfolio events
- Dividend tracker
- Price alerts
- Market news with sentiment tags
- AI-generated market insights

### Additional Tools
- **Stock Comparison** — Side-by-side analysis of multiple stocks
- **Portfolio Rebalancer** — Target allocation vs actual with rebalance suggestions
- **Tax Calculator** — Estimated capital gains/losses
- **Paper Trading** — Practice trading without real money
- **Backtesting** — Test strategies against historical data
- **Correlation Matrix** — See how your holdings move together
- **Sector Heatmap** — Visual sector allocation and performance
- **Learning Center** — Educational content on investing concepts

### Watchlist
- Track potential investments
- Set price alerts with notifications
- Quick AI analysis access
- Notes and target prices

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **State Management**: Zustand (persisted to localStorage)
- **Charts**: Recharts
- **AI**: OpenAI GPT-4
- **Market Data**: Alpha Vantage (stocks, crypto, news, technicals, fundamentals)
- **Sentiment**: Alternative.me Fear & Greed Index (free, no key)
- **CI/CD**: GitHub Actions (weekly scanner agent)
- **Deployment**: Vercel

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

> The app works without API keys using the pre-seeded demo data. Add keys to enable live market data and AI features.

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

## Project Structure

```
/src
├── /app                    # Next.js App Router
│   ├── /api               # API routes
│   │   ├── /stocks        # Stock quotes, history, technicals
│   │   ├── /analysis      # Deep stock analysis (fundamentals + technicals + scoring)
│   │   ├── /crypto        # Cryptocurrency data
│   │   ├── /news          # Financial news + sentiment
│   │   ├── /fundamentals  # Company fundamentals
│   │   ├── /earnings      # Earnings data & calendar
│   │   ├── /screener      # Stock screener
│   │   ├── /sentiment     # Fear & Greed Index
│   │   ├── /commodities   # Precious metals
│   │   ├── /dividends     # Dividend tracking
│   │   ├── /sectors       # Sector allocation
│   │   ├── /insider       # Insider trading activity
│   │   └── /ai            # AI analysis, chat, recommendations
│   ├── /(dashboard)       # Dashboard pages
│   └── page.tsx           # Landing page
├── /components
│   ├── /ui                # shadcn components
│   ├── /layout            # Header, Sidebar
│   ├── /charts            # Performance & price charts
│   ├── /portfolio         # Position management
│   ├── /dashboard         # Dashboard widgets
│   └── /ai                # AI analysis, chat, sentiment
├── /hooks                 # Custom React hooks
├── /store                 # Zustand stores (portfolio, goals, watchlist, etc.)
├── /types                 # TypeScript types
└── /lib
    ├── /api               # API client functions
    ├── /cache             # Rate limiter & ticker cache
    └── /ai                # AI prompts & logic

/scripts
└── /scanner               # Weekly stock scanner agent
    ├── index.ts           # Main entry point
    ├── /phases            # Fetch tickers → Fundamentals → Technicals
    └── /lib               # Alpha Vantage client, scoring algorithm, types
```

## Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
npm run scanner  # Run weekly stock scanner manually
```

## Routes

| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/dashboard` | Main portfolio overview with widgets |
| `/portfolio` | Manage positions and transactions |
| `/analysis` | AI deep analysis (fundamentals, technicals, scoring) |
| `/watchlist` | Track potential investments |
| `/calendar` | Earnings calendar and events |
| `/goals` | Financial goal setting with Monte Carlo simulation |
| `/compare` | Side-by-side stock comparison |
| `/rebalance` | Portfolio rebalancing tool |
| `/tools` | Paper trading, backtesting, correlation matrix |
| `/tax` | Tax estimation calculator |
| `/learn` | Investment education center |
| `/transactions` | Full transaction history |
| `/recommendations` | AI-powered stock recommendations |
| `/settings` | API keys and preferences |

## Disclaimer

This application is for educational and informational purposes only. It is not intended to be investment advice. Always do your own research and consult with a qualified financial advisor before making investment decisions. Past performance does not guarantee future results.

## License

MIT
