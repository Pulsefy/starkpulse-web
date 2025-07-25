import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { } from '@redux-devtools/extension';
import { AuthStore, User, WalletState } from './types';

// Helper function to generate user ID
const generateUserId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// Helper function to shorten wallet address
const shortenAddress = (address: string | null): string | null => {
  if (!address) return null;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

// Mock user creation for demo purposes
const createMockUser = (email: string): User => ({
  id: generateUserId(),
  email,
  username: email.split('@')[0],
  createdAt: new Date(),
  lastLoginAt: new Date(),
});

const initialWalletState: WalletState = {
  address: null,
  shortenedAddress: null,
  isConnected: false,
  isConnecting: false,
  isReconnecting: false,
  connector: null,
  balance: null,
  network: 'mainnet',
  error: null,
};

export const useAuthStore = create<AuthStore>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        sessionToken: null,
        lastActivity: null,
        wallet: initialWalletState,

        // Auth actions
        login: async (credentials) => {
          set({ isLoading: true, error: null });

          try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Mock validation - in real app, this would be API call
            if (credentials.email && credentials.passkey) {
              const user = createMockUser(credentials.email);
              const sessionToken = `session_${generateUserId()}`;

              set({
                user,
                isAuthenticated: true,
                sessionToken,
                lastActivity: new Date(),
                isLoading: false,
                error: null,
              });
            } else {
              throw new Error('Invalid credentials');
            }
          } catch (error: any) {
            set({
              error: error.message || 'Login failed',
              isLoading: false,
            });
            throw error;
          }
        },

        logout: () => {
          set({
            user: null,
            isAuthenticated: false,
            sessionToken: null,
            lastActivity: null,
            wallet: initialWalletState,
            error: null,
          });
        },

        register: async (userData) => {
          set({ isLoading: true, error: null });

          try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1500));

            const user = createMockUser(userData.email);
            const sessionToken = `session_${generateUserId()}`;

            set({
              user,
              isAuthenticated: true,
              sessionToken,
              lastActivity: new Date(),
              isLoading: false,
              error: null,
            });
          } catch (error: any) {
            set({
              error: error.message || 'Registration failed',
              isLoading: false,
            });
            throw error;
          }
        },

        resetPassword: async (email) => {
          set({ isLoading: true, error: null });

          try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Mock success
            set({
              isLoading: false,
              error: null,
            });
          } catch (error: any) {
            set({
              error: error.message || 'Password reset failed',
              isLoading: false,
            });
            throw error;
          }
        },

        // Wallet actions - these will integrate with StarkNet hooks
        connectWallet: async (connector) => {
          const { wallet } = get();

          set({
            wallet: {
              ...wallet,
              isConnecting: true,
              error: null,
            },
          });

          try {
            // This would integrate with StarkNet React hooks
            // For now, simulate wallet connection
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Mock wallet connection success
            const mockAddress = "0x1234567890abcdef1234567890abcdef12345678";
            const mockBalance = "1.234567890";

            set({
              wallet: {
                address: mockAddress,
                shortenedAddress: shortenAddress(mockAddress),
                isConnected: true,
                isConnecting: false,
                isReconnecting: false,
                connector: connector?.name || 'ArgentX',
                balance: mockBalance,
                network: 'mainnet',
                error: null,
              },
            });
          } catch (error: any) {
            set({
              wallet: {
                ...get().wallet,
                isConnecting: false,
                error: error.message || 'Wallet connection failed',
              },
            });
            throw error;
          }
        },

        disconnectWallet: () => {
          set({
            wallet: initialWalletState,
          });
        },

        updateWalletBalance: async () => {
          const { wallet } = get();

          if (!wallet.isConnected || !wallet.address) {
            return;
          }

          try {
            // Simulate balance update
            await new Promise(resolve => setTimeout(resolve, 500));

            // Mock new balance
            const mockBalance = (Math.random() * 10).toFixed(9);

            set({
              wallet: {
                ...wallet,
                balance: mockBalance,
              },
            });
          } catch (error: any) {
            set({
              wallet: {
                ...wallet,
                error: error.message || 'Failed to update balance',
              },
            });
          }
        },

        clearError: () => {
          set({ error: null });
          const { wallet } = get();
          if (wallet.error) {
            set({
              wallet: {
                ...wallet,
                error: null,
              },
            });
          }
        },

        updateLastActivity: () => {
          set({ lastActivity: new Date() });
        },
      }),
      {
        name: 'auth-storage',
        partialize: (state) => ({
          user: state.user,
          isAuthenticated: state.isAuthenticated,
          sessionToken: state.sessionToken,
          lastActivity: state.lastActivity,
          wallet: {
            address: state.wallet.address,
            connector: state.wallet.connector,
            // Don't persist sensitive or temporary state
          },
        }),
      }
    ),
    {
      name: 'auth-store',
    }
  )
);

// Selectors for optimized re-renders
export const useAuthUser = () => useAuthStore((state) => state.user);
export const useAuthStatus = () => useAuthStore((state) => ({
  isAuthenticated: state.isAuthenticated,
  isLoading: state.isLoading,
  error: state.error,
}));
export const useWalletStatus = () => useAuthStore((state) => state.wallet);
export const useAuthActions = () => useAuthStore((state) => ({
  login: state.login,
  logout: state.logout,
  register: state.register,
  resetPassword: state.resetPassword,
  connectWallet: state.connectWallet,
  disconnectWallet: state.disconnectWallet,
  updateWalletBalance: state.updateWalletBalance,
  clearError: state.clearError,
  updateLastActivity: state.updateLastActivity,
})); 