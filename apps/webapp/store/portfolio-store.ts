import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { } from '@redux-devtools/extension';
import { PortfolioStore, PortfolioAsset, Transaction, PriceAlert } from './types';

// Mock data generators
const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// Helper function to calculate portfolio totals
const calculateTotals = (assets: PortfolioAsset[]) => {
  const totalValue = assets.reduce((sum, asset) => sum + asset.value, 0);
  const totalProfitLoss = assets.reduce((sum, asset) => sum + asset.profitLoss, 0);
  const totalProfitLossPercentage = totalValue > 0 ? (totalProfitLoss / (totalValue - totalProfitLoss)) * 100 : 0;

  return {
    totalValue,
    totalProfitLoss,
    totalProfitLossPercentage,
  };
};

const mockAssets: PortfolioAsset[] = [
  {
    id: 'asset_1',
    symbol: 'STRK',
    name: 'StarkNet',
    amount: 1000,
    avgBuyPrice: 1.50,
    currentPrice: 1.85,
    value: 1850,
    profitLoss: 350,
    profitLossPercentage: 23.33,
    lastUpdated: new Date(),
  },
  {
    id: 'asset_2',
    symbol: 'ETH',
    name: 'Ethereum',
    amount: 0.5,
    avgBuyPrice: 3200,
    currentPrice: 3521.78,
    value: 1760.89,
    profitLoss: 160.89,
    profitLossPercentage: 10.06,
    lastUpdated: new Date(),
  },
];

const mockTransactions: Transaction[] = [
  {
    id: 'tx_1',
    type: 'reward',
    asset: 'STRK',
    amount: 12.45,
    price: 1.85,
    value: 23.03,
    fee: 0,
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    status: 'confirmed',
  },
  {
    id: 'tx_2',
    type: 'buy',
    asset: 'ETH',
    amount: 0.1,
    price: 3500,
    value: 350,
    fee: 5.25,
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
    status: 'confirmed',
  },
];

export const usePortfolioStore = create<PortfolioStore>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        assets: mockAssets,
        totalValue: 0,
        totalProfitLoss: 0,
        totalProfitLossPercentage: 0,
        dailyChange: 0,
        dailyChangePercentage: 0,
        transactions: mockTransactions,
        watchlist: ['BTC', 'ETH', 'STRK', 'SOL'],
        favorites: ['STRK', 'ETH'],
        priceAlerts: [],
        isLoading: false,
        error: null,
        lastUpdated: null,



        // Actions
        addAsset: (assetData) => {
          const newAsset: PortfolioAsset = {
            ...assetData,
            id: generateId(),
            lastUpdated: new Date(),
          };

          set((state) => {
            const newAssets = [...state.assets, newAsset];
            const totals = calculateTotals(newAssets);

            return {
              assets: newAssets,
              ...totals,
              lastUpdated: new Date(),
            };
          });
        },

        removeAsset: (assetId) => {
          set((state) => {
            const newAssets = state.assets.filter(asset => asset.id !== assetId);
            const totals = calculateTotals(newAssets);

            return {
              assets: newAssets,
              ...totals,
              lastUpdated: new Date(),
            };
          });
        },

        updateAssetPrice: (assetId, newPrice) => {
          set((state) => {
            const newAssets = state.assets.map(asset => {
              if (asset.id === assetId) {
                const newValue = asset.amount * newPrice;
                const profitLoss = newValue - (asset.amount * asset.avgBuyPrice);
                const profitLossPercentage = ((newPrice - asset.avgBuyPrice) / asset.avgBuyPrice) * 100;

                return {
                  ...asset,
                  currentPrice: newPrice,
                  value: newValue,
                  profitLoss,
                  profitLossPercentage,
                  lastUpdated: new Date(),
                };
              }
              return asset;
            });

            const totals = calculateTotals(newAssets);

            return {
              assets: newAssets,
              ...totals,
              lastUpdated: new Date(),
            };
          });
        },

        addTransaction: (transactionData) => {
          const newTransaction: Transaction = {
            ...transactionData,
            id: generateId(),
          };

          set((state) => ({
            transactions: [newTransaction, ...state.transactions],
            lastUpdated: new Date(),
          }));
        },

        addToWatchlist: (symbol) => {
          set((state) => ({
            watchlist: state.watchlist.includes(symbol)
              ? state.watchlist
              : [...state.watchlist, symbol],
          }));
        },

        removeFromWatchlist: (symbol) => {
          set((state) => ({
            watchlist: state.watchlist.filter(item => item !== symbol),
          }));
        },

        toggleFavorite: (symbol) => {
          set((state) => ({
            favorites: state.favorites.includes(symbol)
              ? state.favorites.filter(item => item !== symbol)
              : [...state.favorites, symbol],
          }));
        },

        createPriceAlert: (alertData) => {
          const newAlert: PriceAlert = {
            ...alertData,
            id: generateId(),
            createdAt: new Date(),
          };

          set((state) => ({
            priceAlerts: [...state.priceAlerts, newAlert],
          }));
        },

        removePriceAlert: (alertId) => {
          set((state) => ({
            priceAlerts: state.priceAlerts.filter(alert => alert.id !== alertId),
          }));
        },

        updatePortfolioData: async () => {
          set({ isLoading: true, error: null });

          try {
            // Simulate API call for portfolio updates
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Mock price updates with realistic fluctuations
            set((state) => {
              const updatedAssets = state.assets.map(asset => {
                // Simulate price changes (-5% to +5%)
                const priceChange = (Math.random() - 0.5) * 0.1;
                const newPrice = asset.currentPrice * (1 + priceChange);
                const newValue = asset.amount * newPrice;
                const profitLoss = newValue - (asset.amount * asset.avgBuyPrice);
                const profitLossPercentage = ((newPrice - asset.avgBuyPrice) / asset.avgBuyPrice) * 100;

                return {
                  ...asset,
                  currentPrice: newPrice,
                  value: newValue,
                  profitLoss,
                  profitLossPercentage,
                  lastUpdated: new Date(),
                };
              });

              const totals = calculateTotals(updatedAssets);

              return {
                assets: updatedAssets,
                ...totals,
                isLoading: false,
                lastUpdated: new Date(),
              };
            });

            // Check price alerts
            const { assets, priceAlerts } = get();
            const triggeredAlerts = priceAlerts.filter(alert => {
              const asset = assets.find(a => a.symbol === alert.symbol);
              if (!asset) return false;

              if (alert.condition === 'above' && asset.currentPrice >= alert.targetPrice) {
                return true;
              }
              if (alert.condition === 'below' && asset.currentPrice <= alert.targetPrice) {
                return true;
              }
              return false;
            });

            // Update triggered alerts
            if (triggeredAlerts.length > 0) {
              set((state) => ({
                priceAlerts: state.priceAlerts.map(alert =>
                  triggeredAlerts.some(ta => ta.id === alert.id)
                    ? { ...alert, triggeredAt: new Date(), isActive: false }
                    : alert
                ),
              }));
            }

          } catch (error: any) {
            set({
              error: error.message || 'Failed to update portfolio data',
              isLoading: false,
            });
          }
        },

        clearError: () => {
          set({ error: null });
        },
      }),
      {
        name: 'portfolio-storage',
        partialize: (state) => ({
          watchlist: state.watchlist,
          favorites: state.favorites,
          priceAlerts: state.priceAlerts,
          // Don't persist assets and transactions for demo
          // In production, you might want to persist some of this data
        }),
      }
    ),
    {
      name: 'portfolio-store',
    }
  )
);

// Selectors for optimized re-renders
export const usePortfolioAssets = () => usePortfolioStore((state) => state.assets);
export const usePortfolioSummary = () => usePortfolioStore((state) => ({
  totalValue: state.totalValue,
  totalProfitLoss: state.totalProfitLoss,
  totalProfitLossPercentage: state.totalProfitLossPercentage,
  dailyChange: state.dailyChange,
  dailyChangePercentage: state.dailyChangePercentage,
  lastUpdated: state.lastUpdated,
}));
export const usePortfolioTransactions = () => usePortfolioStore((state) => state.transactions);
export const useWatchlist = () => usePortfolioStore((state) => state.watchlist);
export const useFavorites = () => usePortfolioStore((state) => state.favorites);
export const usePriceAlerts = () => usePortfolioStore((state) => state.priceAlerts);
export const usePortfolioActions = () => usePortfolioStore((state) => ({
  addAsset: state.addAsset,
  removeAsset: state.removeAsset,
  updateAssetPrice: state.updateAssetPrice,
  addTransaction: state.addTransaction,
  addToWatchlist: state.addToWatchlist,
  removeFromWatchlist: state.removeFromWatchlist,
  toggleFavorite: state.toggleFavorite,
  createPriceAlert: state.createPriceAlert,
  removePriceAlert: state.removePriceAlert,
  updatePortfolioData: state.updatePortfolioData,
  clearError: state.clearError,
}));

// Auto-update portfolio data every 30 seconds
if (typeof window !== 'undefined') {
  setInterval(() => {
    const store = usePortfolioStore.getState();
    if (!store.isLoading) {
      store.updatePortfolioData();
    }
  }, 30000);
} 