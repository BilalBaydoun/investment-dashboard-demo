import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type AlertCondition = 'above' | 'below';
export type AlertStatus = 'active' | 'triggered' | 'dismissed';

export interface PriceAlert {
  id: string;
  symbol: string;
  name: string;
  targetPrice: number;
  condition: AlertCondition;
  currentPrice: number;
  createdAt: Date;
  triggeredAt?: Date;
  status: AlertStatus;
  notes?: string;
}

interface AlertsState {
  alerts: PriceAlert[];
  notificationsEnabled: boolean;

  // Actions
  addAlert: (alert: Omit<PriceAlert, 'id' | 'createdAt' | 'status'>) => void;
  removeAlert: (id: string) => void;
  updateAlert: (id: string, updates: Partial<PriceAlert>) => void;
  checkAlerts: (prices: Record<string, number>) => PriceAlert[];
  dismissAlert: (id: string) => void;
  reactivateAlert: (id: string) => void;
  toggleNotifications: () => void;
  getActiveAlerts: () => PriceAlert[];
  getTriggeredAlerts: () => PriceAlert[];
}

const generateId = () => crypto.randomUUID();

export const useAlertsStore = create<AlertsState>()(
  persist(
    (set, get) => ({
      alerts: [],
      notificationsEnabled: true,

      addAlert: (alertData) =>
        set((state) => ({
          alerts: [
            ...state.alerts,
            {
              ...alertData,
              id: generateId(),
              createdAt: new Date(),
              status: 'active' as AlertStatus,
            },
          ],
        })),

      removeAlert: (id) =>
        set((state) => ({
          alerts: state.alerts.filter((alert) => alert.id !== id),
        })),

      updateAlert: (id, updates) =>
        set((state) => ({
          alerts: state.alerts.map((alert) =>
            alert.id === id ? { ...alert, ...updates } : alert
          ),
        })),

      checkAlerts: (prices) => {
        const state = get();
        const triggeredAlerts: PriceAlert[] = [];

        state.alerts.forEach((alert) => {
          if (alert.status !== 'active') return;

          const currentPrice = prices[alert.symbol];
          if (currentPrice === undefined) return;

          let isTriggered = false;
          if (alert.condition === 'above' && currentPrice >= alert.targetPrice) {
            isTriggered = true;
          } else if (alert.condition === 'below' && currentPrice <= alert.targetPrice) {
            isTriggered = true;
          }

          if (isTriggered) {
            triggeredAlerts.push({ ...alert, currentPrice });
          }
        });

        // Update triggered alerts in state
        if (triggeredAlerts.length > 0) {
          set((state) => ({
            alerts: state.alerts.map((alert) => {
              const triggered = triggeredAlerts.find((t) => t.id === alert.id);
              if (triggered) {
                return {
                  ...alert,
                  status: 'triggered' as AlertStatus,
                  triggeredAt: new Date(),
                  currentPrice: triggered.currentPrice,
                };
              }
              return alert;
            }),
          }));
        }

        return triggeredAlerts;
      },

      dismissAlert: (id) =>
        set((state) => ({
          alerts: state.alerts.map((alert) =>
            alert.id === id ? { ...alert, status: 'dismissed' as AlertStatus } : alert
          ),
        })),

      reactivateAlert: (id) =>
        set((state) => ({
          alerts: state.alerts.map((alert) =>
            alert.id === id
              ? { ...alert, status: 'active' as AlertStatus, triggeredAt: undefined }
              : alert
          ),
        })),

      toggleNotifications: () =>
        set((state) => ({ notificationsEnabled: !state.notificationsEnabled })),

      getActiveAlerts: () => {
        return get().alerts.filter((alert) => alert.status === 'active');
      },

      getTriggeredAlerts: () => {
        return get().alerts.filter((alert) => alert.status === 'triggered');
      },
    }),
    {
      name: 'price-alerts-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
