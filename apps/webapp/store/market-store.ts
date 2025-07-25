import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { } from '@redux-devtools/extension';
import { MarketStore, CryptoAsset } from './types';
import { mockCryptoData, type CryptoData } from '@/lib/mock-data';

// Helper function to convert mock data to store format
const convertMockCryptoToAssets = (mockCrypto: CryptoData[]): CryptoAsset[] => {
  return mockCrypto.map((crypto) => {
    // Generate sparkline data (15 points) based on 24h change
    const sparkline = Array.from({ length: 15 }, (_, i) => {
      const baseValue = 50;
      const trend = crypto.change24h > 0 ? i * 2 : -i * 2;
      const noise = (Math.random() - 0.5) * 10;
      return Math.max(0, Math.min(100, baseValue + trend + noise));
    });

    return {
      id: crypto.id.toString(),
      name: crypto.name,
      symbol: crypto.symbol,
      icon: `/crypto-icons/${crypto.symbol.toLowerCase()}.png`,
      price: crypto.price,
      change1h: (Math.random() - 0.5) * 4, // -2% to +2% for 1h change
      change24h: crypto.change24h,
      change7d: (Math.random() - 0.5) * 20, // -10% to +10% for 7d change
      volume24h: crypto.volume24h,
      marketCap: crypto.marketCap,
      circulatingSupply: crypto.circulatingSupply,
      sparkline,
    };
  });
};

export const useMarketStore = create<MarketStore>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        cryptoAssets: [],
        trending: [],
        gainers: [],
        losers: [],
        totalMarketCap: 0,
        totalVolume: 0,
        btcDominance: 0,
        fearGreedIndex: 0,
        isLoading: false,
        error: null,
        lastUpdated: null,

        // Actions
        fetchMarketData: async () => {
          set({ isLoading: true, error: null });

          try {
            // Simulate API call delay
            await new Promise(resolve => setTimeout(resolve, 1200));

            // Use existing mock data
            const assets = convertMockCryptoToAssets(mockCryptoData);

            // Sort and categorize assets
            const sortedByChange = [...assets].sort((a, b) => b.change24h - a.change24h);
            const gainers = sortedByChange.filter(a => a.change24h > 0).slice(0, 3);
            const losers = sortedByChange.filter(a => a.change24h < 0).slice(-3).reverse();

            // Get trending (high volume assets)
            const trending = [...assets]
              .sort((a, b) => b.volume24h - a.volume24h)
              .slice(0, 3);

            // Calculate market metrics
            const totalMarketCap = assets.reduce((sum: number, asset: CryptoAsset) => sum + asset.marketCap, 0);
            const totalVolume = assets.reduce((sum: number, asset: CryptoAsset) => sum + asset.volume24h, 0);
            const btcMarketCap = assets.find((a: CryptoAsset) => a.symbol === 'BTC')?.marketCap || 0;
            const btcDominance = totalMarketCap > 0 ? (btcMarketCap / totalMarketCap) * 100 : 0;

            // Generate Fear & Greed Index (mock)
            const fearGreedIndex = Math.floor(Math.random() * 100);

            set({
              cryptoAssets: assets,
              trending,
              gainers,
              losers,
              totalMarketCap,
              totalVolume,
              btcDominance,
              fearGreedIndex,
              isLoading: false,
              lastUpdated: new Date(),
            });

          } catch (error: any) {
            set({
              error: error.message || 'Failed to fetch market data',
              isLoading: false,
            });
          }
        },

        fetchAssetDetails: async (symbol) => {
          try {
            // Simulate API call for specific asset
            await new Promise(resolve => setTimeout(resolve, 500));

            const { cryptoAssets } = get();
            const asset = cryptoAssets.find(a => a.symbol === symbol);

            if (asset) {
              // Update asset with fresh data
              const updatedAsset = {
                ...asset,
                price: asset.price * (1 + (Math.random() - 0.5) * 0.02), // Small price update
              };

              set((state) => ({
                cryptoAssets: state.cryptoAssets.map(a =>
                  a.symbol === symbol ? updatedAsset : a
                ),
                lastUpdated: new Date(),
              }));

              return updatedAsset;
            }

            return null;
          } catch (error: any) {
            set({ error: error.message || 'Failed to fetch asset details' });
            return null;
          }
        },

        updatePrices: async () => {
          const { cryptoAssets, isLoading } = get();

          if (isLoading || cryptoAssets.length === 0) return;

          try {
            // Simulate price updates without full reload
            const updatedAssets = cryptoAssets.map(asset => {
              const priceChange = (Math.random() - 0.5) * 0.02; // Small changes
              const newPrice = asset.price * (1 + priceChange);

              return {
                ...asset,
                price: newPrice,
                change1h: (Math.random() - 0.5) * 2, // New 1h change
              };
            });

            set({
              cryptoAssets: updatedAssets,
              lastUpdated: new Date(),
            });

          } catch (error: any) {
            set({ error: error.message || 'Failed to update prices' });
          }
        },

        clearError: () => {
          set({ error: null });
        },
      }),
      {
        name: 'market-storage',
        partialize: (state) => ({
          // Don't persist market data as it should be fresh
          lastUpdated: state.lastUpdated,
        }),
      }
    ),
    {
      name: 'market-store',
    }
  )
);

// Selectors for optimized re-renders
export const useCryptoAssets = () => useMarketStore((state) => state.cryptoAssets);
export const useTrendingAssets = () => useMarketStore((state) => state.trending);
export const useMarketMovers = () => useMarketStore((state) => ({
  gainers: state.gainers,
  losers: state.losers,
}));
export const useMarketMetrics = () => useMarketStore((state) => ({
  totalMarketCap: state.totalMarketCap,
  totalVolume: state.totalVolume,
  btcDominance: state.btcDominance,
  fearGreedIndex: state.fearGreedIndex,
}));
export const useMarketStatus = () => useMarketStore((state) => ({
  isLoading: state.isLoading,
  error: state.error,
  lastUpdated: state.lastUpdated,
}));
export const useMarketActions = () => useMarketStore((state) => ({
  fetchMarketData: state.fetchMarketData,
  fetchAssetDetails: state.fetchAssetDetails,
  updatePrices: state.updatePrices,
  clearError: state.clearError,
}));

// Auto-update prices every 15 seconds, full market data every 5 minutes
if (typeof window !== 'undefined') {
  // Price updates every 15 seconds
  setInterval(() => {
    const store = useMarketStore.getState();
    if (!store.isLoading) {
      store.updatePrices();
    }
  }, 15000);

  // Full market data refresh every 5 minutes
  setInterval(() => {
    const store = useMarketStore.getState();
    if (!store.isLoading) {
      store.fetchMarketData();
    }
  }, 5 * 60 * 1000);
} 