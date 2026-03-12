'use client';

import { useState, useCallback } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { useWatchlistStore } from '@/store/watchlistStore';
import { useThemeStore } from '@/store/themeStore';
import { useAlertsStore } from '@/store/alertsStore';
import { usePaperTradingStore } from '@/store/paperTradingStore';
import { toast } from 'sonner';

export function useSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  const portfolioStore = usePortfolioStore();
  const watchlistStore = useWatchlistStore();
  const { preferences } = useThemeStore();
  const alertsStore = useAlertsStore();
  const paperTradingStore = usePaperTradingStore();

  const pushToCloud = useCallback(async () => {
    setIsSyncing(true);
    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portfolios: portfolioStore.portfolios,
          transactions: portfolioStore.transactions,
          watchlist: watchlistStore.items,
          goal: watchlistStore.goal,
          preferences,
          alerts: alertsStore.alerts,
          paperTrading: {
            cashBalance: paperTradingStore.cashBalance,
            startingBalance: paperTradingStore.startingBalance,
            positions: paperTradingStore.positions,
            trades: paperTradingStore.trades,
            isActive: paperTradingStore.isActive,
          },
        }),
      });

      const data = await response.json();
      if (data.success) {
        setLastSynced(new Date().toISOString());
        toast.success('Data synced to cloud');
      } else {
        toast.error(data.error || 'Sync failed');
      }
    } catch {
      toast.error('Failed to connect to sync service');
    } finally {
      setIsSyncing(false);
    }
  }, [portfolioStore.portfolios, portfolioStore.transactions, watchlistStore.items, watchlistStore.goal, preferences, alertsStore.alerts, paperTradingStore.cashBalance, paperTradingStore.startingBalance, paperTradingStore.positions, paperTradingStore.trades, paperTradingStore.isActive]);

  const pullFromCloud = useCallback(async () => {
    setIsSyncing(true);
    try {
      const response = await fetch('/api/sync');
      const data = await response.json();

      if (data.success && data.data) {
        // Update stores directly — no page reload needed
        if (data.data.portfolios && data.data.portfolios.length > 0) {
          usePortfolioStore.setState({
            portfolios: data.data.portfolios,
            activePortfolioId: data.data.portfolios[0]?.id || null,
            transactions: data.data.transactions || [],
          });
        }

        if (data.data.watchlist && data.data.watchlist.length > 0) {
          useWatchlistStore.setState({
            items: data.data.watchlist,
            goal: data.data.goal || null,
          });
        }

        if (data.data.alerts && data.data.alerts.length > 0) {
          useAlertsStore.setState({
            alerts: data.data.alerts,
          });
        }

        if (data.data.paperTrading) {
          usePaperTradingStore.setState({
            cashBalance: data.data.paperTrading.cashBalance,
            startingBalance: data.data.paperTrading.startingBalance,
            positions: data.data.paperTrading.positions || [],
            trades: data.data.paperTrading.trades || [],
            isActive: data.data.paperTrading.isActive || false,
          });
        }

        setLastSynced(data.data.updatedAt);
        toast.success('Data loaded from cloud');
      } else {
        toast.error(data.error || 'No cloud data found');
      }
    } catch {
      toast.error('Failed to connect to sync service');
    } finally {
      setIsSyncing(false);
    }
  }, []);

  return {
    isSyncing,
    lastSynced,
    pushToCloud,
    pullFromCloud,
  };
}
