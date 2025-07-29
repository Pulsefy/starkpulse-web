// Main store exports
export { useAuthStore } from "./auth-store";
export { usePortfolioStore } from "./portfolio-store";
export { useUIStore } from "./ui-store";
export { useNewsStore } from "./news-store";
export { useMarketStore } from "./market-store";
export {
  useErrorStore,
  useErrorSelectors,
  useErrorActions,
} from "./error-store";

// Selectors
export * from "./auth-store";
export * from "./portfolio-store";
export * from "./ui-store";
export * from "./news-store";
export * from "./market-store";
export * from "./error-store";

// Types
export * from "./types";

// Enhanced selectors for specific use cases
export const useNotifications = () => {
  const { useUIStore } = require("./ui-store");
  return useUIStore((state: any) => ({
    notifications: state.notifications,
    notificationsPanelOpen: state.notificationsPanelOpen,
    unreadCount: state.notifications.filter((n: any) => !n.read).length,
  }));
};

export const useUIActions = () => {
  const { useUIStore } = require("./ui-store");
  return useUIStore((state: any) => ({
    setTheme: state.setTheme,
    toggleTheme: state.toggleTheme,
    setLanguage: state.setLanguage,
    toggleSidebar: state.toggleSidebar,
    setSidebarCollapsed: state.setSidebarCollapsed,
    toggleMobileMenu: state.toggleMobileMenu,
    setMobileMenuOpen: state.setMobileMenuOpen,
    openModal: state.openModal,
    closeModal: state.closeModal,
    closeAllModals: state.closeAllModals,
    setLoading: state.setLoading,
    setGlobalLoading: state.setGlobalLoading,
    addNotification: state.addNotification,
    markNotificationAsRead: state.markNotificationAsRead,
    removeNotification: state.removeNotification,
    clearAllNotifications: state.clearAllNotifications,
    toggleNotificationsPanel: state.toggleNotificationsPanel,
    setSearchQuery: state.setSearchQuery,
    setFilter: state.setFilter,
    clearFilters: state.clearFilters,
    setCurrentPage: state.setCurrentPage,
    showToast: state.showToast,
    removeToast: state.removeToast,
    clearAllToasts: state.clearAllToasts,
  }));
};

/**
 * Hook to get the current loading state across all stores
 */
export const useGlobalLoading = () => {
  const { useAuthStore } = require("./auth-store");
  const { usePortfolioStore } = require("./portfolio-store");

  const authLoading = useAuthStore((state: any) => state.isLoading);
  const { useUIStore } = require("./ui-store");
  const uiLoading = useUIStore((state: any) => state.loading.global);
  const portfolioLoading = usePortfolioStore((state: any) => state.isLoading);

  return authLoading || uiLoading || portfolioLoading;
};

/**
 * Hook to get all errors across stores
 */
export const useGlobalErrors = () => {
  const { useAuthStore } = require("./auth-store");
  const { usePortfolioStore } = require("./portfolio-store");
  const { useErrorStore } = require("./error-store");

  const authError = useAuthStore((state: any) => state.error);
  const portfolioError = usePortfolioStore((state: any) => state.error);
  const errorStoreErrors = useErrorStore((state: any) => state.errors);

  const errors = [
    ...(authError ? [authError] : []),
    ...(portfolioError ? [portfolioError] : []),
    ...errorStoreErrors,
  ];
  return errors;
};

/**
 * Hook to get user authentication and wallet status
 */
export const useUserStatus = () => {
  const { useAuthStore } = require("./auth-store");

  const { isAuthenticated, user } = useAuthStore((state: any) => ({
    isAuthenticated: state.isAuthenticated,
    user: state.user,
  }));

  const { isConnected, address } = useAuthStore((state: any) => ({
    isConnected: state.wallet.isConnected,
    address: state.wallet.address,
  }));

  return {
    isAuthenticated,
    user,
    isWalletConnected: isConnected,
    walletAddress: address,
  };
};

/**
 * Hook to clear all errors across stores
 */
export const useClearAllErrors = () => {
  const { useAuthStore } = require("./auth-store");
  const { usePortfolioStore } = require("./portfolio-store");
  const { useErrorStore } = require("./error-store");

  const clearAuthError = useAuthStore((state: any) => state.clearError);
  const clearPortfolioError = usePortfolioStore(
    (state: any) => state.clearError
  );
  const clearErrorStoreErrors = useErrorStore(
    (state: any) => state.clearAllErrors
  );

  return () => {
    clearAuthError();
    clearPortfolioError();
    clearErrorStoreErrors();
  };
};

/**
 * Store initialization function - call this on app startup
 */
export const initializeStores = async () => {
  try {
    // Initialize UI store theme
    const { useUIStore } = require("./ui-store");
    const uiStore = useUIStore.getState();
    const theme = uiStore.theme;

    if (typeof window !== "undefined") {
      const effectiveTheme =
        theme === "system"
          ? window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light"
          : theme;
      document.documentElement.setAttribute("data-theme", effectiveTheme);
    }

    // Fetch initial market data
    const { useMarketStore } = require("./market-store");
    const marketStore = useMarketStore.getState();
    marketStore.fetchMarketData();

    // Fetch initial news
    const { useNewsStore } = require("./news-store");
    const newsStore = useNewsStore.getState();
    newsStore.fetchNews();
    newsStore.fetchFeaturedNews();

    // Initialize portfolio if user is authenticated
    const { useAuthStore } = require("./auth-store");
    const authStore = useAuthStore.getState();
    if (authStore.isAuthenticated) {
      const { usePortfolioStore } = require("./portfolio-store");
      const portfolioStore = usePortfolioStore.getState();
      portfolioStore.updatePortfolioData();
    }

    console.log("✅ Zustand stores initialized successfully");
  } catch (error) {
    console.error("❌ Failed to initialize stores:", error);
  }
};

/**
 * Development helpers
 */
export const devTools = {
  // Get all store states (for debugging)
  getAllStates: () => {
    const { useAuthStore } = require("./auth-store");
    const { usePortfolioStore } = require("./portfolio-store");
    const { useUIStore } = require("./ui-store");
    const { useNewsStore } = require("./news-store");
    const { useMarketStore } = require("./market-store");

    return {
      auth: useAuthStore.getState(),
      portfolio: usePortfolioStore.getState(),
      ui: useUIStore.getState(),
      news: useNewsStore.getState(),
      market: useMarketStore.getState(),
    };
  },

  // Reset all stores to initial state
  resetAllStores: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("auth-storage");
      localStorage.removeItem("portfolio-storage");
      localStorage.removeItem("ui-storage");
      localStorage.removeItem("news-storage");
      localStorage.removeItem("market-storage");
      window.location.reload();
    }
  },

  // Enable/disable auto-updates
  toggleAutoUpdates: (enabled: boolean) => {
    if (enabled) {
      console.log("🔄 Auto-updates enabled");
    } else {
      console.log("⏸️ Auto-updates disabled");
      // Note: Currently auto-updates are handled by setInterval
      // In production, you might want to implement a more sophisticated system
    }
  },
};

// Make dev tools available globally in development
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  (window as any).__STARKPULSE_DEV_TOOLS__ = devTools;
  console.log(
    "🛠️ StarkPulse dev tools available at window.__STARKPULSE_DEV_TOOLS__"
  );
}
