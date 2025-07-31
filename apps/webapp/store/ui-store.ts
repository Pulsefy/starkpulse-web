import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { } from '@redux-devtools/extension';
import { UIStore, Notification } from './types';

// Helper function to generate notification ID
const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// Helper function to get system theme preference
const getSystemTheme = (): 'dark' | 'light' => {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const initialModalsState = {
  walletConnect: false,
  settings: false,
  portfolio: false,
  priceAlert: false,
  news: false,
};

const initialLoadingState = {
  global: false,
  auth: false,
  portfolio: false,
  news: false,
  wallet: false,
};

export const useUIStore = create<UIStore>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        theme: 'dark',
        language: 'en',
        rtl: false,
        sidebarCollapsed: false,
        mobileMenuOpen: false,
        modals: initialModalsState,
        loading: initialLoadingState,
        notifications: [],
        notificationsPanelOpen: false,
        searchQuery: '',
        activeFilters: {},
        currentPage: 'home',
        previousPage: null,
        toasts: [],

        // Theme actions
        setTheme: (theme) => {
          set({ theme });

          // Apply theme to document
          if (typeof window !== 'undefined') {
            const root = document.documentElement;
            if (theme === 'system') {
              const systemTheme = getSystemTheme();
              root.setAttribute('data-theme', systemTheme);
            } else {
              root.setAttribute('data-theme', theme);
            }
          }
        },

        toggleTheme: () => {
          const { theme } = get();
          const newTheme = theme === 'dark' ? 'light' : 'dark';
          get().setTheme(newTheme);
        },

        // Language actions
        setLanguage: (language) => {
          set({ language, rtl: ['ar', 'he', 'fa', 'ur'].includes(language) });

          // Apply language to document
          if (typeof window !== 'undefined') {
            document.documentElement.lang = language;
            document.documentElement.dir = ['ar', 'he', 'fa', 'ur'].includes(language) ? 'rtl' : 'ltr';
          }
        },

        // Layout actions
        toggleSidebar: () => {
          set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
        },

        setSidebarCollapsed: (collapsed) => {
          set({ sidebarCollapsed: collapsed });
        },

        toggleMobileMenu: () => {
          set((state) => ({ mobileMenuOpen: !state.mobileMenuOpen }));
        },

        setMobileMenuOpen: (open) => {
          set({ mobileMenuOpen: open });
        },

        // Modal actions
        openModal: (modal) => {
          set((state) => ({
            modals: {
              ...state.modals,
              [modal]: true,
            },
            // Close mobile menu when opening modals
            mobileMenuOpen: false,
          }));
        },

        closeModal: (modal) => {
          set((state) => ({
            modals: {
              ...state.modals,
              [modal]: false,
            },
          }));
        },

        closeAllModals: () => {
          set({ modals: initialModalsState });
        },

        // Loading actions
        setLoading: (key, loading) => {
          set((state) => ({
            loading: {
              ...state.loading,
              [key]: loading,
            },
          }));
        },

        setGlobalLoading: (loading) => {
          set((state) => ({
            loading: {
              ...state.loading,
              global: loading,
            },
          }));
        },

        // Notification actions
        addNotification: (notificationData) => {
          const notification: Notification = {
            ...notificationData,
            id: generateId(),
            timestamp: new Date(),
          };

          set((state) => ({
            notifications: [notification, ...state.notifications],
          }));

          // Auto-remove non-persistent notifications after 5 seconds
          if (!notification.persistent) {
            setTimeout(() => {
              get().removeNotification(notification.id);
            }, 5000);
          }
        },

        markNotificationAsRead: (notificationId) => {
          set((state) => ({
            notifications: state.notifications.map(notification =>
              notification.id === notificationId
                ? { ...notification, read: true }
                : notification
            ),
          }));
        },

        removeNotification: (notificationId) => {
          set((state) => ({
            notifications: state.notifications.filter(notification =>
              notification.id !== notificationId
            ),
          }));
        },

        clearAllNotifications: () => {
          set({ notifications: [] });
        },

        toggleNotificationsPanel: () => {
          set((state) => ({ notificationsPanelOpen: !state.notificationsPanelOpen }));
        },

        // Search and filter actions
        setSearchQuery: (query) => {
          set({ searchQuery: query });
        },

        setFilter: (key, value) => {
          set((state) => ({
            activeFilters: {
              ...state.activeFilters,
              [key]: value,
            },
          }));
        },

        clearFilters: () => {
          set({ activeFilters: {} });
        },

        // Page navigation
        setCurrentPage: (page) => {
          set((state) => ({
            previousPage: state.currentPage,
            currentPage: page,
          }));
        },

        // Toast actions
        showToast: (message, type = 'info', duration = 4000) => {
          const toast = {
            id: generateId(),
            message,
            type,
            duration,
          };

          set((state) => ({
            toasts: [...state.toasts, toast],
          }));

          // Auto-remove toast after duration
          setTimeout(() => {
            get().removeToast(toast.id);
          }, duration);
        },

        removeToast: (toastId) => {
          set((state) => ({
            toasts: state.toasts.filter(toast => toast.id !== toastId),
          }));
        },

        clearAllToasts: () => {
          set({ toasts: [] });
        },
      }),
      {
        name: 'ui-storage',
        partialize: (state) => ({
          theme: state.theme,
          language: state.language,
          rtl: state.rtl,
          sidebarCollapsed: state.sidebarCollapsed,
          activeFilters: state.activeFilters,
          // Don't persist temporary UI state like modals, loading, etc.
        }),
      }
    ),
    {
      name: 'ui-store',
    }
  )
);

// Selectors for optimized re-renders
export const useTheme = () => useUIStore((state) => state.theme);
export const useLanguage = () => useUIStore((state) => ({
  language: state.language,
  rtl: state.rtl,
}));
export const useLayout = () => useUIStore((state) => ({
  sidebarCollapsed: state.sidebarCollapsed,
  mobileMenuOpen: state.mobileMenuOpen,
}));
export const useModals = () => useUIStore((state) => state.modals);
export const useLoading = () => useUIStore((state) => state.loading);
export const useNotifications = () => useUIStore((state) => ({
  notifications: state.notifications,
  notificationsPanelOpen: state.notificationsPanelOpen,
  unreadCount: state.notifications.filter(n => !n.read).length,
}));
export const useSearch = () => useUIStore((state) => ({
  searchQuery: state.searchQuery,
  activeFilters: state.activeFilters,
}));
export const useNavigation = () => useUIStore((state) => ({
  currentPage: state.currentPage,
  previousPage: state.previousPage,
}));
export const useToasts = () => useUIStore((state) => state.toasts);

export const useUIActions = () => useUIStore((state) => ({
  // Theme actions
  setTheme: state.setTheme,
  toggleTheme: state.toggleTheme,

  // Language actions
  setLanguage: state.setLanguage,

  // Layout actions
  toggleSidebar: state.toggleSidebar,
  setSidebarCollapsed: state.setSidebarCollapsed,
  toggleMobileMenu: state.toggleMobileMenu,
  setMobileMenuOpen: state.setMobileMenuOpen,

  // Modal actions
  openModal: state.openModal,
  closeModal: state.closeModal,
  closeAllModals: state.closeAllModals,

  // Loading actions
  setLoading: state.setLoading,
  setGlobalLoading: state.setGlobalLoading,

  // Notification actions
  addNotification: state.addNotification,
  markNotificationAsRead: state.markNotificationAsRead,
  removeNotification: state.removeNotification,
  clearAllNotifications: state.clearAllNotifications,
  toggleNotificationsPanel: state.toggleNotificationsPanel,

  // Search and filter actions
  setSearchQuery: state.setSearchQuery,
  setFilter: state.setFilter,
  clearFilters: state.clearFilters,

  // Page navigation
  setCurrentPage: state.setCurrentPage,

  // Toast actions
  showToast: state.showToast,
  removeToast: state.removeToast,
  clearAllToasts: state.clearAllToasts,
}));

// Initialize theme on load
if (typeof window !== 'undefined') {
  const store = useUIStore.getState();
  const theme = store.theme;

  const effectiveTheme = theme === 'system' ? getSystemTheme() : theme;
  document.documentElement.setAttribute('data-theme', effectiveTheme);

  // Listen for system theme changes
  if (theme === 'system') {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', (e) => {
      if (useUIStore.getState().theme === 'system') {
        document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
      }
    });
  }
} 