export interface User {
  id: string;
  email: string;
  username?: string;
  avatar?: string;
  createdAt: Date;
  lastLoginAt: Date;
}

export interface WalletState {
  address: string | null;
  shortenedAddress: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;
  connector: string | null;
  balance: string | null;
  network: string;
  error: string | null;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  sessionToken: string | null;
  lastActivity: Date | null;
  wallet: WalletState;
}

export interface AuthActions {
  login: (credentials: { email: string; passkey: string }) => Promise<void>;
  logout: () => void;
  register: (userData: { username: string; email: string; password: string }) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  connectWallet: (connector: any) => Promise<void>;
  disconnectWallet: () => void;
  updateWalletBalance: () => Promise<void>;
  clearError: () => void;
  updateLastActivity: () => void;
}

export interface CryptoAsset {
  id: string;
  name: string;
  symbol: string;
  icon: string;
  price: number;
  change1h: number;
  change24h: number;
  change7d: number;
  volume24h: number;
  marketCap: number;
  circulatingSupply: number;
  sparkline: number[];
}

export interface PortfolioAsset {
  id: string;
  symbol: string;
  name: string;
  amount: number;
  value: number;
  avgBuyPrice: number;
  currentPrice: number;
  profitLoss: number;
  profitLossPercentage: number;
  lastUpdated: Date;
}

export interface Transaction {
  id: string;
  type: 'buy' | 'sell' | 'stake' | 'unstake' | 'reward' | 'transfer';
  asset: string;
  amount: number;
  price: number;
  value: number;
  fee: number;
  timestamp: Date;
  txHash?: string;
  status: 'pending' | 'confirmed' | 'failed';
}

export interface PriceAlert {
  id: string;
  symbol: string;
  condition: 'above' | 'below';
  targetPrice: number;
  currentPrice: number;
  isActive: boolean;
  createdAt: Date;
  triggeredAt?: Date;
}

export interface PortfolioState {
  assets: PortfolioAsset[];
  totalValue: number;
  totalProfitLoss: number;
  totalProfitLossPercentage: number;
  dailyChange: number;
  dailyChangePercentage: number;
  transactions: Transaction[];
  watchlist: string[];
  favorites: string[];
  priceAlerts: PriceAlert[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export interface PortfolioActions {
  addAsset: (asset: Omit<PortfolioAsset, 'id' | 'lastUpdated'>) => void;
  removeAsset: (assetId: string) => void;
  updateAssetPrice: (assetId: string, newPrice: number) => void;
  addTransaction: (transaction: Omit<Transaction, 'id'>) => void;
  addToWatchlist: (symbol: string) => void;
  removeFromWatchlist: (symbol: string) => void;
  toggleFavorite: (symbol: string) => void;
  createPriceAlert: (alert: Omit<PriceAlert, 'id' | 'createdAt'>) => void;
  removePriceAlert: (alertId: string) => void;
  updatePortfolioData: () => Promise<void>;
  clearError: () => void;
}

export interface NewsArticle {
  id: string;
  title: string;
  description: string;
  content?: string;
  author: string;
  source: string;
  url: string;
  imageUrl?: string;
  publishedAt: Date;
  category: string[];
  sentiment: 'positive' | 'negative' | 'neutral';
  relevantAssets: string[];
}

export interface NewsState {
  articles: NewsArticle[];
  featuredArticles: NewsArticle[];
  categories: string[];
  selectedCategory: string | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  hasMore: boolean;
  page: number;
}

export interface NewsActions {
  fetchNews: (category?: string, page?: number) => Promise<void>;
  fetchFeaturedNews: () => Promise<void>;
  selectCategory: (category: string | null) => void;
  loadMore: () => Promise<void>;
  refreshNews: () => Promise<void>;
  clearError: () => void;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  category: 'system' | 'price_alert' | 'news' | 'portfolio' | 'wallet';
  read: boolean;
  persistent: boolean;
  timestamp: Date;
  actionUrl?: string;
  metadata?: Record<string, any>;
}

export interface UIState {
  // Theme system
  theme: 'dark' | 'light' | 'system';

  // Language and localization
  language: string;
  rtl: boolean;

  // Layout states
  sidebarCollapsed: boolean;
  mobileMenuOpen: boolean;

  // Modal states
  modals: {
    walletConnect: boolean;
    settings: boolean;
    portfolio: boolean;
    priceAlert: boolean;
    news: boolean;
  };

  // Loading states
  loading: {
    global: boolean;
    auth: boolean;
    portfolio: boolean;
    news: boolean;
    wallet: boolean;
  };

  // Notification system
  notifications: Notification[];
  notificationsPanelOpen: boolean;

  // Search and filters
  searchQuery: string;
  activeFilters: Record<string, any>;

  // Page states
  currentPage: string;
  previousPage: string | null;

  // Toast notifications
  toasts: Array<{
    id: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    duration?: number;
  }>;
}

export interface UIActions {
  // Theme actions
  setTheme: (theme: 'dark' | 'light' | 'system') => void;
  toggleTheme: () => void;

  // Language actions
  setLanguage: (language: string) => void;

  // Layout actions
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleMobileMenu: () => void;
  setMobileMenuOpen: (open: boolean) => void;

  // Modal actions
  openModal: (modal: keyof UIState['modals']) => void;
  closeModal: (modal: keyof UIState['modals']) => void;
  closeAllModals: () => void;

  // Loading actions
  setLoading: (key: keyof UIState['loading'], loading: boolean) => void;
  setGlobalLoading: (loading: boolean) => void;

  // Notification actions
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  markNotificationAsRead: (notificationId: string) => void;
  removeNotification: (notificationId: string) => void;
  clearAllNotifications: () => void;
  toggleNotificationsPanel: () => void;

  // Search and filter actions
  setSearchQuery: (query: string) => void;
  setFilter: (key: string, value: any) => void;
  clearFilters: () => void;

  // Page navigation
  setCurrentPage: (page: string) => void;

  // Toast actions
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info', duration?: number) => void;
  removeToast: (toastId: string) => void;
  clearAllToasts: () => void;
}

// Market data types
export interface MarketData {
  cryptoAssets: CryptoAsset[];
  trending: CryptoAsset[];
  gainers: CryptoAsset[];
  losers: CryptoAsset[];
  totalMarketCap: number;
  totalVolume: number;
  btcDominance: number;
  fearGreedIndex: number;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export interface MarketActions {
  fetchMarketData: () => Promise<void>;
  fetchAssetDetails: (symbol: string) => Promise<CryptoAsset | null>;
  updatePrices: () => Promise<void>;
  clearError: () => void;
}

// Combined store types
export type AuthStore = AuthState & AuthActions;
export type PortfolioStore = PortfolioState & PortfolioActions;
export type NewsStore = NewsState & NewsActions;
export type UIStore = UIState & UIActions;
export type MarketStore = MarketData & MarketActions; 