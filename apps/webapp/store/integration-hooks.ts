import { useEffect } from 'react';
import { useAccount, useConnect, useDisconnect } from '@starknet-react/core';
import { useAuthStore } from './auth-store';
import { useUIStore } from './ui-store';
import { usePortfolioStore } from './portfolio-store';

/**
 * Integration hook that syncs StarkNet React state with Auth store
 * This allows the existing StarkNet hooks to work alongside Zustand
 */
export const useStarkNetIntegration = () => {
  const { address, isConnected, isReconnecting, status } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  // Get Zustand store actions
  const { wallet, updateWalletBalance } = useAuthStore((state) => ({
    wallet: state.wallet,
    updateWalletBalance: state.updateWalletBalance,
  }));

  const setWalletState = useAuthStore((state) => ({
    connectWallet: state.connectWallet,
    disconnectWallet: state.disconnectWallet,
    clearError: state.clearError,
  }));

  // Sync StarkNet state with Zustand store
  useEffect(() => {
    if (address && isConnected) {
      // Update Zustand store with StarkNet connection
      useAuthStore.setState((state) => ({
        wallet: {
          ...state.wallet,
          address,
          shortenedAddress: `${address.slice(0, 6)}...${address.slice(-4)}`,
          isConnected,
          isReconnecting: isReconnecting || false,
          isConnecting: false,
          error: null,
        },
      }));

      // Update balance
      updateWalletBalance();
    } else if (!isConnected && wallet.isConnected) {
      // Wallet disconnected - update store
      useAuthStore.setState((state) => ({
        wallet: {
          ...state.wallet,
          address: null,
          shortenedAddress: null,
          isConnected: false,
          isReconnecting: false,
          balance: null,
          error: null,
        },
      }));
    }
  }, [address, isConnected, isReconnecting, wallet.isConnected, updateWalletBalance]);

  // Enhanced wallet connection that works with both systems
  const enhancedConnect = async (connectorId?: string) => {
    const targetConnector = connectorId
      ? connectors.find(c => c.id === connectorId)
      : connectors.find(c => c.id === 'argentX' || c.id === 'argent' || c.name?.toLowerCase().includes('argent'));

    if (targetConnector) {
      try {
        // Update UI loading state
        useUIStore.getState().setLoading('wallet', true);

        // Use StarkNet React hook
        await connect({ connector: targetConnector });

        useUIStore.getState().setLoading('wallet', false);
      } catch (error: any) {
        useUIStore.getState().setLoading('wallet', false);

        // Update error in store
        useAuthStore.setState((state) => ({
          wallet: {
            ...state.wallet,
            error: error.message || 'Failed to connect wallet',
          },
        }));

        throw error;
      }
    } else {
      // Fallback to Zustand-only connection
      await setWalletState.connectWallet(targetConnector);
    }
  };

  const enhancedDisconnect = async () => {
    try {
      await disconnect();
      setWalletState.disconnectWallet();
    } catch (error) {
      console.error('Disconnect error:', error);
      // Still update store even if StarkNet disconnect fails
      setWalletState.disconnectWallet();
    }
  };

  return {
    address,
    isConnected,
    isReconnecting,
    status,
    connectors,

    connect: enhancedConnect,
    disconnect: enhancedDisconnect,

    wallet,
    clearError: setWalletState.clearError,
  };
};


/**
 * Hook to automatically update portfolio when wallet connects
 */
export const usePortfolioSync = () => {
  const isWalletConnected = useAuthStore((state) => state.wallet.isConnected);
  const updatePortfolioData = usePortfolioStore((state) => state.updatePortfolioData);

  useEffect(() => {
    if (isWalletConnected) {
      // Update portfolio data when wallet connects
      updatePortfolioData();
    }
  }, [isWalletConnected, updatePortfolioData]);
};

/**
 * Hook to handle automatic notifications for portfolio changes
 */
export const usePortfolioNotifications = () => {
  const addNotification = useUIStore((state) => state.addNotification);
  const priceAlerts = usePortfolioStore((state) => state.priceAlerts);
  const assets = usePortfolioStore((state) => state.assets);

  useEffect(() => {
    // Check for triggered price alerts
    const triggeredAlerts = priceAlerts.filter(alert => alert.triggeredAt);

    triggeredAlerts.forEach(alert => {
      const asset = assets.find(a => a.symbol === alert.symbol);
      if (asset) {
        addNotification({
          title: 'Price Alert Triggered',
          message: `${alert.symbol} ${alert.condition === 'above' ? 'exceeded' : 'dropped below'} $${alert.targetPrice}`,
          type: 'info',
          category: 'price_alert',
          read: false,
          persistent: false,
          actionUrl: `/portfolio`,
        });
      }
    });
  }, [priceAlerts, assets, addNotification]);
};

/**
 * Hook to sync theme changes with CSS variables
 */
export const useThemeSync = () => {
  const theme = useUIStore((state) => state.theme);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const applyTheme = (themeName: 'dark' | 'light') => {
      document.documentElement.setAttribute('data-theme', themeName);

      // You can add more theme-specific logic here
      // For example, updating meta theme-color
      const metaThemeColor = document.querySelector('meta[name="theme-color"]');
      if (metaThemeColor) {
        metaThemeColor.setAttribute('content', themeName === 'dark' ? '#000000' : '#ffffff');
      }
    };

    if (theme === 'system') {
      // Follow system preference
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e: MediaQueryListEvent) => {
        applyTheme(e.matches ? 'dark' : 'light');
      };

      applyTheme(mediaQuery.matches ? 'dark' : 'light');
      mediaQuery.addEventListener('change', handleChange);

      return () => {
        mediaQuery.removeEventListener('change', handleChange);
      };
    } else {
      applyTheme(theme);
    }
  }, [theme]);
};

/**
 * Main integration hook that sets up all integrations
 */
export const useStarkPulseIntegration = () => {
  useStarkNetIntegration();
  usePortfolioSync();
  usePortfolioNotifications();
  useThemeSync();

  // Initialize stores on mount
  useEffect(() => {
    const initStores = async () => {
      try {
        // Import and call initialization
        const { initializeStores } = await import('./index');
        await initializeStores();
      } catch (error) {
        console.error('Failed to initialize stores:', error);
      }
    };

    initStores();
  }, []);
};


// Enhanced wallet hook that combines auth store with UI state
export const useEnhancedWallet = () => {
  const { wallet, connectWallet, disconnectWallet } = useAuthStore();
  const { showToast } = useUIStore();

  const connect = async (connector: string) => {
    try {
      await connectWallet(connector);
      showToast('Wallet connected successfully!', 'success');
    } catch (error) {
      showToast('Failed to connect wallet', 'error');
    }
  };

  const disconnect = () => {
    disconnectWallet();
    showToast('Wallet disconnected', 'info');
  };

  const getShortAddress = () => {
    if (!wallet.address) return '';
    return `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`;
  };

  return {
    ...wallet,
    connect,
    disconnect,
    getShortAddress,
    isConnected: !!wallet.address,
  };
};

// Enhanced notification system
export const useEnhancedNotifications = () => {
  const {
    notifications,
    notificationsPanelOpen,
    addNotification,
    markNotificationAsRead,
    removeNotification,
    clearAllNotifications,
    toggleNotificationsPanel
  } = useUIStore();

  const showNotification = (title: string, message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    addNotification({
      title,
      message,
      type,
      category: 'wallet',
      read: false,
      persistent: false,
    });
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return {
    notifications,
    notificationsPanelOpen,
    unreadCount,
    showNotification,
    markAsRead: markNotificationAsRead,
    removeNotification,
    clearAll: clearAllNotifications,
    togglePanel: toggleNotificationsPanel,
  };
};

// Enhanced loading states
export const useLoadingStates = () => {
  const { loading, setLoading, setGlobalLoading } = useUIStore();

  return {
    ...loading,
    setLoading,
    setGlobalLoading,
    isAnyLoading: Object.values(loading).some(Boolean),
  };
}; 