'use client';

import { useEffect, useRef } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { useWatchlistStore } from '@/store/watchlistStore';
import { useThemeStore } from '@/store/themeStore';
import { useAlertsStore } from '@/store/alertsStore';
import { usePaperTradingStore } from '@/store/paperTradingStore';
import { useGoalsStore } from '@/store/goalsStore';

const DEBOUNCE_MS = 3000;
const PULL_COOLDOWN_MS = 60000; // Only pull once per minute
const SYNC_KEY = 'last-cloud-sync';

function getLastSyncTime(): number {
  const val = typeof window !== 'undefined' ? localStorage.getItem(SYNC_KEY) : null;
  return val ? parseInt(val, 10) : 0;
}

function setLastSyncTime() {
  localStorage.setItem(SYNC_KEY, Date.now().toString());
}

export function AutoSync() {
  const hasHydrated = useRef(false);
  const hasPulled = useRef(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSyncing = useRef(false);
  const skipNextPush = useRef(false);

  // Subscribe to all store states for auto-push
  const portfolios = usePortfolioStore((s) => s.portfolios);
  const transactions = usePortfolioStore((s) => s.transactions);
  const watchlistItems = useWatchlistStore((s) => s.items);
  const watchlistGoal = useWatchlistStore((s) => s.goal);
  const preferences = useThemeStore((s) => s.preferences);
  const alerts = useAlertsStore((s) => s.alerts);
  const ptCash = usePaperTradingStore((s) => s.cashBalance);
  const ptStarting = usePaperTradingStore((s) => s.startingBalance);
  const ptPositions = usePaperTradingStore((s) => s.positions);
  const ptTrades = usePaperTradingStore((s) => s.trades);
  const ptActive = usePaperTradingStore((s) => s.isActive);
  const savedGoals = useGoalsStore((s) => s.goals);
  const activeGoalId = useGoalsStore((s) => s.activeGoalId);

  // Auto-pull on first load — updates stores directly, no reload
  useEffect(() => {
    if (hasPulled.current) return;
    hasPulled.current = true;

    const timeSinceLastSync = Date.now() - getLastSyncTime();
    if (timeSinceLastSync < PULL_COOLDOWN_MS) return;

    const pullFromCloud = async () => {
      try {
        const response = await fetch('/api/sync');
        const data = await response.json();

        if (!data.success || !data.data) return;

        // Prevent the store updates from triggering an auto-push
        skipNextPush.current = true;

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

        if (data.data.savedGoals && data.data.savedGoals.length > 0) {
          useGoalsStore.setState({
            goals: data.data.savedGoals,
            activeGoalId: data.data.activeGoalId || data.data.savedGoals[0]?.id || null,
          });
        }

        setLastSyncTime();
      } catch {
        // Silent fail
      }
    };

    pullFromCloud();
  }, []);

  // Auto-push when any store data changes (debounced)
  useEffect(() => {
    // Skip the initial hydration render
    if (!hasHydrated.current) {
      hasHydrated.current = true;
      return;
    }

    // Skip push if this change came from a pull
    if (skipNextPush.current) {
      skipNextPush.current = false;
      return;
    }

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(async () => {
      if (isSyncing.current) return;
      isSyncing.current = true;

      try {
        await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            portfolios,
            transactions,
            watchlist: watchlistItems,
            goal: watchlistGoal,
            preferences,
            alerts,
            paperTrading: {
              cashBalance: ptCash,
              startingBalance: ptStarting,
              positions: ptPositions,
              trades: ptTrades,
              isActive: ptActive,
            },
            savedGoals,
            activeGoalId,
          }),
        });
        setLastSyncTime();
      } catch {
        // Silent fail
      } finally {
        isSyncing.current = false;
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [portfolios, transactions, watchlistItems, watchlistGoal, preferences, alerts, ptCash, ptStarting, ptPositions, ptTrades, ptActive, savedGoals, activeGoalId]);

  return null;
}
