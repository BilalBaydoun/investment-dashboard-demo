'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  DollarSign,
  Users,
  Building2,
  Landmark,
  Info,
  Bell,
  BellOff,
} from 'lucide-react';
import { usePortfolioStore } from '@/store/portfolioStore';

// Types
interface EconomicEvent {
  id: string;
  name: string;
  type: 'fed' | 'cpi' | 'jobs' | 'gdp' | 'retail' | 'housing' | 'earnings';
  date: Date;
  time: string;
  impact: 'high' | 'medium' | 'low';
  previous?: string;
  forecast?: string;
  actual?: string;
  description: string;
  portfolioImpact: {
    stocks: 'positive' | 'negative' | 'neutral' | 'mixed';
    bonds: 'positive' | 'negative' | 'neutral' | 'mixed';
    crypto: 'positive' | 'negative' | 'neutral' | 'mixed';
    description: string;
  };
}

// Generate upcoming economic events (simulated data based on typical schedule)
function generateEconomicEvents(): EconomicEvent[] {
  const today = new Date();
  const events: EconomicEvent[] = [];

  // Helper to get next occurrence of a day
  const getNextDate = (daysFromNow: number) => {
    const date = new Date(today);
    date.setDate(date.getDate() + daysFromNow);
    return date;
  };

  // FOMC Meetings (8 per year, roughly every 6 weeks)
  events.push({
    id: 'fomc-1',
    name: 'FOMC Interest Rate Decision',
    type: 'fed',
    date: getNextDate(12),
    time: '2:00 PM ET',
    impact: 'high',
    previous: '5.25-5.50%',
    forecast: '5.25-5.50%',
    description: 'The Federal Open Market Committee announces its decision on the federal funds rate target range.',
    portfolioImpact: {
      stocks: 'mixed',
      bonds: 'negative',
      crypto: 'mixed',
      description: 'Rate holds expected. Higher-for-longer rates may pressure growth stocks but benefit financials. Bond prices remain under pressure.'
    }
  });

  events.push({
    id: 'fomc-2',
    name: 'Fed Chair Press Conference',
    type: 'fed',
    date: getNextDate(12),
    time: '2:30 PM ET',
    impact: 'high',
    description: 'Federal Reserve Chair provides economic outlook and takes questions from the press.',
    portfolioImpact: {
      stocks: 'mixed',
      bonds: 'mixed',
      crypto: 'mixed',
      description: 'Watch for forward guidance on future rate path. Hawkish tone could pressure equities; dovish signals could boost risk assets.'
    }
  });

  // CPI Report (monthly, typically mid-month)
  events.push({
    id: 'cpi-1',
    name: 'Consumer Price Index (CPI)',
    type: 'cpi',
    date: getNextDate(5),
    time: '8:30 AM ET',
    impact: 'high',
    previous: '3.2% YoY',
    forecast: '3.1% YoY',
    description: 'Measures the average change in prices paid by consumers for goods and services.',
    portfolioImpact: {
      stocks: 'positive',
      bonds: 'positive',
      crypto: 'positive',
      description: 'Lower inflation could signal Fed rate cuts sooner, boosting all risk assets. Tech and growth stocks particularly sensitive.'
    }
  });

  events.push({
    id: 'cpi-core',
    name: 'Core CPI (Ex Food & Energy)',
    type: 'cpi',
    date: getNextDate(5),
    time: '8:30 AM ET',
    impact: 'high',
    previous: '4.0% YoY',
    forecast: '3.9% YoY',
    description: 'Core inflation excludes volatile food and energy prices, giving a clearer picture of underlying inflation trends.',
    portfolioImpact: {
      stocks: 'positive',
      bonds: 'positive',
      crypto: 'neutral',
      description: 'Fed watches core CPI closely. Declining core inflation increases probability of rate cuts in 2024.'
    }
  });

  // Jobs Report (first Friday of each month)
  events.push({
    id: 'nfp-1',
    name: 'Non-Farm Payrolls',
    type: 'jobs',
    date: getNextDate(8),
    time: '8:30 AM ET',
    impact: 'high',
    previous: '+216K',
    forecast: '+180K',
    description: 'Measures the change in the number of employed people, excluding farm workers.',
    portfolioImpact: {
      stocks: 'mixed',
      bonds: 'mixed',
      crypto: 'neutral',
      description: 'Strong jobs = healthy economy but may delay rate cuts. Weak jobs = recession fears but faster rate cuts. "Goldilocks" number ideal.'
    }
  });

  events.push({
    id: 'unemp-1',
    name: 'Unemployment Rate',
    type: 'jobs',
    date: getNextDate(8),
    time: '8:30 AM ET',
    impact: 'high',
    previous: '3.7%',
    forecast: '3.8%',
    description: 'Percentage of the total labor force that is unemployed but actively seeking employment.',
    portfolioImpact: {
      stocks: 'mixed',
      bonds: 'mixed',
      crypto: 'neutral',
      description: 'Rising unemployment could signal economic slowdown but also hasten Fed rate cuts.'
    }
  });

  // GDP (quarterly)
  events.push({
    id: 'gdp-1',
    name: 'GDP Growth Rate (Q4 Advance)',
    type: 'gdp',
    date: getNextDate(18),
    time: '8:30 AM ET',
    impact: 'high',
    previous: '4.9% QoQ',
    forecast: '2.0% QoQ',
    description: 'First estimate of the annualized rate of change in economic output.',
    portfolioImpact: {
      stocks: 'positive',
      bonds: 'negative',
      crypto: 'positive',
      description: 'Strong GDP growth is bullish for equities but may keep rates elevated. Slowdown expected from Q3.'
    }
  });

  // Retail Sales
  events.push({
    id: 'retail-1',
    name: 'Retail Sales',
    type: 'retail',
    date: getNextDate(10),
    time: '8:30 AM ET',
    impact: 'medium',
    previous: '0.3% MoM',
    forecast: '0.4% MoM',
    description: 'Measures the total receipts of retail stores, indicating consumer spending strength.',
    portfolioImpact: {
      stocks: 'positive',
      bonds: 'neutral',
      crypto: 'neutral',
      description: 'Strong retail sales indicate healthy consumer spending, benefiting consumer discretionary stocks.'
    }
  });

  // Housing
  events.push({
    id: 'housing-1',
    name: 'Existing Home Sales',
    type: 'housing',
    date: getNextDate(15),
    time: '10:00 AM ET',
    impact: 'medium',
    previous: '3.79M',
    forecast: '3.82M',
    description: 'Annualized number of existing residential buildings sold.',
    portfolioImpact: {
      stocks: 'neutral',
      bonds: 'neutral',
      crypto: 'neutral',
      description: 'Housing data impacts homebuilders and related sectors. High rates continue to pressure housing market.'
    }
  });

  // Initial Jobless Claims (weekly)
  events.push({
    id: 'claims-1',
    name: 'Initial Jobless Claims',
    type: 'jobs',
    date: getNextDate(3),
    time: '8:30 AM ET',
    impact: 'medium',
    previous: '202K',
    forecast: '210K',
    description: 'Weekly count of new filings for unemployment benefits.',
    portfolioImpact: {
      stocks: 'neutral',
      bonds: 'neutral',
      crypto: 'neutral',
      description: 'Leading indicator of labor market health. Sudden spikes could signal economic trouble.'
    }
  });

  // PPI
  events.push({
    id: 'ppi-1',
    name: 'Producer Price Index (PPI)',
    type: 'cpi',
    date: getNextDate(6),
    time: '8:30 AM ET',
    impact: 'medium',
    previous: '1.0% YoY',
    forecast: '0.9% YoY',
    description: 'Measures the average change in selling prices received by domestic producers.',
    portfolioImpact: {
      stocks: 'neutral',
      bonds: 'neutral',
      crypto: 'neutral',
      description: 'Leading indicator of consumer inflation. Declining PPI suggests CPI may follow.'
    }
  });

  // Sort by date
  return events.sort((a, b) => a.date.getTime() - b.date.getTime());
}

const eventTypeIcons: Record<string, typeof Calendar> = {
  fed: Landmark,
  cpi: DollarSign,
  jobs: Users,
  gdp: TrendingUp,
  retail: Building2,
  housing: Building2,
  earnings: TrendingUp,
};

const eventTypeColors: Record<string, string> = {
  fed: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  cpi: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  jobs: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  gdp: 'bg-green-500/20 text-green-400 border-green-500/30',
  retail: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  housing: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  earnings: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
};

const impactColors = {
  high: 'bg-red-500/20 text-red-400',
  medium: 'bg-yellow-500/20 text-yellow-400',
  low: 'bg-green-500/20 text-green-400',
};

const assetImpactIcons = {
  positive: <TrendingUp className="h-4 w-4 text-green-400" />,
  negative: <TrendingDown className="h-4 w-4 text-red-400" />,
  neutral: <span className="h-4 w-4 text-muted-foreground">—</span>,
  mixed: <AlertTriangle className="h-4 w-4 text-yellow-400" />,
};

export default function EconomicCalendarPage() {
  const getActivePortfolio = usePortfolioStore((state) => state.getActivePortfolio);
  const [selectedEvent, setSelectedEvent] = useState<EconomicEvent | null>(null);
  const [notifications, setNotifications] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<string>('all');

  const events = useMemo(() => generateEconomicEvents(), []);

  const filteredEvents = useMemo(() => {
    if (filterType === 'all') return events;
    return events.filter(e => e.type === filterType);
  }, [events, filterType]);

  // Calculate portfolio exposure
  const portfolioExposure = useMemo(() => {
    const portfolio = getActivePortfolio();
    const positions = portfolio?.positions || [];
    const total = positions.reduce((sum, p) => sum + p.quantity * p.currentPrice, 0);
    const stocks = positions
      .filter(p => p.assetType === 'stock' || p.assetType === 'etf')
      .reduce((sum, p) => sum + p.quantity * p.currentPrice, 0);
    const crypto = positions
      .filter(p => p.assetType === 'crypto')
      .reduce((sum, p) => sum + p.quantity * p.currentPrice, 0);
    const bonds = positions
      .filter(p => p.assetType === 'bond')
      .reduce((sum, p) => sum + p.quantity * p.currentPrice, 0);

    return {
      stocks: total > 0 ? (stocks / total) * 100 : 0,
      crypto: total > 0 ? (crypto / total) * 100 : 0,
      bonds: total > 0 ? (bonds / total) * 100 : 0,
    };
  }, [getActivePortfolio]);

  const toggleNotification = (eventId: string) => {
    setNotifications(prev => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };

  const formatDate = (date: Date) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }
  };

  const getDaysUntil = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventDate = new Date(date);
    eventDate.setHours(0, 0, 0, 0);
    return Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl md:text-3xl font-bold">Economic Calendar</h1>
          <p className="text-xs md:text-sm text-muted-foreground">
            Track market-moving events and their impact on your portfolio
          </p>
        </div>
        <Badge variant="outline" className="gap-1 w-fit shrink-0">
          <Calendar className="h-3 w-3" />
          {events.filter(e => getDaysUntil(e.date) <= 7).length} this week
        </Badge>
      </div>

      {/* Portfolio Sensitivity Overview */}
      <Card>
        <CardHeader className="p-4 md:p-6 pb-2 md:pb-2">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <AlertTriangle className="h-4 w-4 md:h-5 md:w-5 text-yellow-400" />
            Portfolio Sensitivity
          </CardTitle>
          <CardDescription className="text-xs md:text-sm">
            How events may affect your holdings
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-2 md:pt-2">
          <div className="grid gap-3 md:gap-4 grid-cols-3">
            <div className="p-2 md:p-4 rounded-lg bg-muted/50">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-1 md:mb-2">
                <span className="text-[10px] md:text-sm text-muted-foreground">Stocks</span>
                <span className="text-sm md:text-base font-semibold">{portfolioExposure.stocks.toFixed(1)}%</span>
              </div>
              <p className="text-[10px] md:text-xs text-muted-foreground hidden sm:block">
                Sensitive to Fed, CPI & jobs
              </p>
            </div>
            <div className="p-2 md:p-4 rounded-lg bg-muted/50">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-1 md:mb-2">
                <span className="text-[10px] md:text-sm text-muted-foreground">Bonds</span>
                <span className="text-sm md:text-base font-semibold">{portfolioExposure.bonds.toFixed(1)}%</span>
              </div>
              <p className="text-[10px] md:text-xs text-muted-foreground hidden sm:block">
                Inverse to rates & inflation
              </p>
            </div>
            <div className="p-2 md:p-4 rounded-lg bg-muted/50">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-1 md:mb-2">
                <span className="text-[10px] md:text-sm text-muted-foreground">Crypto</span>
                <span className="text-sm md:text-base font-semibold">{portfolioExposure.crypto.toFixed(1)}%</span>
              </div>
              <p className="text-[10px] md:text-xs text-muted-foreground hidden sm:block">
                Follows risk sentiment
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Event Filters */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-3 px-3 md:mx-0 md:px-0 md:flex-wrap">
        <Button
          variant={filterType === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterType('all')}
          className="shrink-0"
        >
          All
        </Button>
        <Button
          variant={filterType === 'fed' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterType('fed')}
          className="gap-1 shrink-0"
        >
          <Landmark className="h-3.5 w-3.5" />
          Fed
        </Button>
        <Button
          variant={filterType === 'cpi' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterType('cpi')}
          className="gap-1 shrink-0"
        >
          <DollarSign className="h-3.5 w-3.5" />
          Inflation
        </Button>
        <Button
          variant={filterType === 'jobs' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterType('jobs')}
          className="gap-1 shrink-0"
        >
          <Users className="h-3.5 w-3.5" />
          Jobs
        </Button>
        <Button
          variant={filterType === 'gdp' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterType('gdp')}
          className="gap-1 shrink-0"
        >
          <TrendingUp className="h-3.5 w-3.5" />
          GDP
        </Button>
      </div>

      {/* Main Content */}
      <div className="grid gap-4 md:gap-6 lg:grid-cols-3">
        {/* Events List */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="p-4 md:p-6 pb-2 md:pb-2">
              <CardTitle className="text-base md:text-lg">Upcoming Events</CardTitle>
              <CardDescription className="text-xs md:text-sm">
                Tap an event for impact analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 md:p-6 pt-2 md:pt-2 space-y-2 md:space-y-3">
              {filteredEvents.map((event) => {
                const Icon = eventTypeIcons[event.type];
                const daysUntil = getDaysUntil(event.date);
                const isSelected = selectedEvent?.id === event.id;

                return (
                  <div
                    key={event.id}
                    className={`p-3 md:p-4 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50 hover:bg-muted/50'
                    }`}
                    onClick={() => setSelectedEvent(event)}
                  >
                    <div className="flex items-start gap-2 md:gap-3">
                      <div className={`p-1.5 md:p-2 rounded-lg shrink-0 ${eventTypeColors[event.type]}`}>
                        <Icon className="h-3.5 w-3.5 md:h-4 md:w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-medium text-sm md:text-base leading-tight">{event.name}</h3>
                          <div className="flex items-center gap-1 shrink-0">
                            <Badge className={`${impactColors[event.impact]} text-[10px] md:text-xs px-1.5 md:px-2`}>
                              {event.impact}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 md:h-8 md:w-8 shrink-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleNotification(event.id);
                              }}
                            >
                              {notifications.has(event.id) ? (
                                <Bell className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
                              ) : (
                                <BellOff className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground" />
                              )}
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 md:gap-2 mt-1 text-xs md:text-sm text-muted-foreground flex-wrap">
                          <Clock className="h-3 w-3 shrink-0" />
                          <span>{formatDate(event.date)}</span>
                          <span>•</span>
                          <span>{event.time}</span>
                          {daysUntil <= 3 && daysUntil >= 0 && (
                            <>
                              <span>•</span>
                              <span className="text-yellow-400">
                                {daysUntil === 0 ? 'Today!' : `${daysUntil}d`}
                              </span>
                            </>
                          )}
                        </div>
                        {(event.previous || event.forecast) && (
                          <div className="flex items-center gap-3 md:gap-4 mt-1.5 md:mt-2 text-xs md:text-sm">
                            {event.previous && (
                              <span>
                                <span className="text-muted-foreground">Prev:</span>{' '}
                                <span className="font-medium">{event.previous}</span>
                              </span>
                            )}
                            {event.forecast && (
                              <span>
                                <span className="text-muted-foreground">Fcst:</span>{' '}
                                <span className="font-medium">{event.forecast}</span>
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Event Detail / Impact Analysis */}
        <div className="space-y-4">
          {selectedEvent ? (
            <>
              <Card>
                <CardHeader className="p-4 md:p-6 pb-2 md:pb-2">
                  <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                    <Info className="h-4 w-4 md:h-5 md:w-5" />
                    Event Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 md:p-6 pt-2 md:pt-2 space-y-3 md:space-y-4">
                  <div>
                    <h3 className="font-semibold text-sm md:text-lg">{selectedEvent.name}</h3>
                    <p className="text-xs md:text-sm text-muted-foreground mt-1">
                      {selectedEvent.description}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:gap-4 text-xs md:text-sm">
                    <div>
                      <span className="text-muted-foreground">Date</span>
                      <p className="font-medium">{formatDate(selectedEvent.date)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Time</span>
                      <p className="font-medium">{selectedEvent.time}</p>
                    </div>
                    {selectedEvent.previous && (
                      <div>
                        <span className="text-muted-foreground">Previous</span>
                        <p className="font-medium">{selectedEvent.previous}</p>
                      </div>
                    )}
                    {selectedEvent.forecast && (
                      <div>
                        <span className="text-muted-foreground">Forecast</span>
                        <p className="font-medium">{selectedEvent.forecast}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="p-4 md:p-6 pb-2 md:pb-2">
                  <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                    <TrendingUp className="h-4 w-4 md:h-5 md:w-5" />
                    Portfolio Impact
                  </CardTitle>
                  <CardDescription className="text-xs md:text-sm">
                    Effect on different asset classes
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 md:p-6 pt-2 md:pt-2 space-y-3 md:space-y-4">
                  <div className="space-y-2 md:space-y-3">
                    <div className="flex items-center justify-between p-2 md:p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2 text-sm">
                        <TrendingUp className="h-3.5 w-3.5 md:h-4 md:w-4" />
                        <span>Stocks</span>
                        {portfolioExposure.stocks > 0 && (
                          <Badge variant="outline" className="text-[10px] md:text-xs px-1 md:px-2">
                            {portfolioExposure.stocks.toFixed(0)}%
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {assetImpactIcons[selectedEvent.portfolioImpact.stocks]}
                        <span className="capitalize text-xs md:text-sm">
                          {selectedEvent.portfolioImpact.stocks}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-2 md:p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2 text-sm">
                        <Building2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                        <span>Bonds</span>
                        {portfolioExposure.bonds > 0 && (
                          <Badge variant="outline" className="text-[10px] md:text-xs px-1 md:px-2">
                            {portfolioExposure.bonds.toFixed(0)}%
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {assetImpactIcons[selectedEvent.portfolioImpact.bonds]}
                        <span className="capitalize text-xs md:text-sm">
                          {selectedEvent.portfolioImpact.bonds}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-2 md:p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2 text-sm">
                        <DollarSign className="h-3.5 w-3.5 md:h-4 md:w-4" />
                        <span>Crypto</span>
                        {portfolioExposure.crypto > 0 && (
                          <Badge variant="outline" className="text-[10px] md:text-xs px-1 md:px-2">
                            {portfolioExposure.crypto.toFixed(0)}%
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {assetImpactIcons[selectedEvent.portfolioImpact.crypto]}
                        <span className="capitalize text-xs md:text-sm">
                          {selectedEvent.portfolioImpact.crypto}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="p-2 md:p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <p className="text-xs md:text-sm">
                      {selectedEvent.portfolioImpact.description}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="p-4 md:p-6 pb-2 md:pb-2">
                  <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                    <AlertTriangle className="h-4 w-4 md:h-5 md:w-5 text-yellow-400" />
                    Trading Tips
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 md:p-6 pt-2 md:pt-2">
                  <ul className="space-y-2 text-xs md:text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="text-primary shrink-0">•</span>
                      Avoid large positions 30min before high-impact events
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary shrink-0">•</span>
                      Reduce position sizes during volatile periods
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary shrink-0">•</span>
                      Set stop-losses for unexpected moves
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary shrink-0">•</span>
                      Wait for volatility to settle before trading
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="hidden lg:block">
              <CardContent className="py-12">
                <div className="text-center text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">Select an event to see impact analysis</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Market Impact Legend */}
      <Card>
        <CardHeader className="p-4 md:p-6 pb-2 md:pb-2">
          <CardTitle className="text-base md:text-lg">Understanding Indicators</CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-2 md:pt-2">
          <div className="grid gap-4 md:gap-6 grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="flex items-center gap-2 mb-1 md:mb-2">
                <div className={`p-1.5 md:p-2 rounded-lg ${eventTypeColors.fed}`}>
                  <Landmark className="h-3.5 w-3.5 md:h-4 md:w-4" />
                </div>
                <h4 className="font-medium text-sm md:text-base">Fed</h4>
              </div>
              <p className="text-[10px] md:text-sm text-muted-foreground">
                Rate changes affect borrowing costs and stock valuations.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1 md:mb-2">
                <div className={`p-1.5 md:p-2 rounded-lg ${eventTypeColors.cpi}`}>
                  <DollarSign className="h-3.5 w-3.5 md:h-4 md:w-4" />
                </div>
                <h4 className="font-medium text-sm md:text-base">Inflation</h4>
              </div>
              <p className="text-[10px] md:text-sm text-muted-foreground">
                CPI/PPI show price pressures. High inflation pressures stocks.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1 md:mb-2">
                <div className={`p-1.5 md:p-2 rounded-lg ${eventTypeColors.jobs}`}>
                  <Users className="h-3.5 w-3.5 md:h-4 md:w-4" />
                </div>
                <h4 className="font-medium text-sm md:text-base">Jobs</h4>
              </div>
              <p className="text-[10px] md:text-sm text-muted-foreground">
                Strong jobs may delay rate cuts; weak data signals slowdown.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1 md:mb-2">
                <div className={`p-1.5 md:p-2 rounded-lg ${eventTypeColors.gdp}`}>
                  <TrendingUp className="h-3.5 w-3.5 md:h-4 md:w-4" />
                </div>
                <h4 className="font-medium text-sm md:text-base">GDP</h4>
              </div>
              <p className="text-[10px] md:text-sm text-muted-foreground">
                Overall output. Strong growth is bullish; negative signals recession.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
