import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { } from '@redux-devtools/extension';
import { NewsStore, NewsArticle } from './types';
import { mockNewsData, type NewsData } from '@/lib/mock-data';

// Helper function to convert mock data to store format
const convertMockNewsToArticles = (mockNews: NewsData[]): NewsArticle[] => {
  return mockNews.map((news) => ({
    id: news.id.toString(),
    title: news.title,
    description: news.excerpt,
    content: news.excerpt + ' Full article content would be here...',
    author: news.author,
    source: 'StarkPulse News',
    url: `https://starkpulse.com/news/${news.id}`,
    imageUrl: news.imageUrl,
    publishedAt: new Date(news.date === '2 hours ago' ? Date.now() - 2 * 60 * 60 * 1000 :
      news.date === '5 hours ago' ? Date.now() - 5 * 60 * 60 * 1000 :
        news.date === '1 day ago' ? Date.now() - 24 * 60 * 60 * 1000 :
          news.date === '2 days ago' ? Date.now() - 2 * 24 * 60 * 60 * 1000 :
            news.date === '3 days ago' ? Date.now() - 3 * 24 * 60 * 60 * 1000 :
              news.date === '4 days ago' ? Date.now() - 4 * 24 * 60 * 60 * 1000 :
                Date.now() - 5 * 24 * 60 * 60 * 1000),
    category: [news.category],
    sentiment: 'neutral' as const,
    relevantAssets: news.category === 'DeFi' ? ['ETH', 'STRK'] :
      news.category === 'NFTs' ? ['ETH'] : ['STRK'],
  }));
};

export const useNewsStore = create<NewsStore>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        articles: [],
        featuredArticles: [],
        categories: ['All', 'Ecosystem', 'DeFi', 'Development', 'NFTs', 'Funding', 'Exchange', 'Identity'],
        selectedCategory: null,
        isLoading: false,
        error: null,
        lastUpdated: null,
        hasMore: true,
        page: 1,

        // Actions
        fetchNews: async (category, page = 1) => {
          set({ isLoading: true, error: null });

          try {
            // Simulate API call delay
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Use existing mock data
            const allArticles = convertMockNewsToArticles(mockNewsData);
            const filteredArticles = category && category !== 'All'
              ? allArticles.filter((article: NewsArticle) => article.category.includes(category))
              : allArticles;

            set((state) => ({
              articles: page === 1 ? filteredArticles : [...state.articles, ...filteredArticles],
              isLoading: false,
              lastUpdated: new Date(),
              page,
              hasMore: false, // Using static mock data, so no pagination
            }));

          } catch (error: any) {
            set({
              error: error.message || 'Failed to fetch news',
              isLoading: false,
            });
          }
        },

        fetchFeaturedNews: async () => {
          set({ isLoading: true, error: null });

          try {
            // Simulate API call delay
            await new Promise(resolve => setTimeout(resolve, 800));

            // Use first 3 articles as featured
            const allArticles = convertMockNewsToArticles(mockNewsData);
            const featuredArticles = allArticles.slice(0, 3);

            set({
              featuredArticles,
              isLoading: false,
              lastUpdated: new Date(),
            });

          } catch (error: any) {
            set({
              error: error.message || 'Failed to fetch featured news',
              isLoading: false,
            });
          }
        },

        selectCategory: (category) => {
          set({ selectedCategory: category, page: 1 });

          // Fetch news for the selected category
          get().fetchNews(category === 'All' ? undefined : category || undefined, 1);
        },

        loadMore: async () => {
          const { page, selectedCategory, hasMore, isLoading } = get();

          if (!hasMore || isLoading) return;

          const nextPage = page + 1;
          await get().fetchNews(selectedCategory === 'All' ? undefined : selectedCategory || undefined, nextPage);
        },

        refreshNews: async () => {
          const { selectedCategory } = get();
          await get().fetchNews(selectedCategory === 'All' ? undefined : selectedCategory || undefined, 1);
          await get().fetchFeaturedNews();
        },

        clearError: () => {
          set({ error: null });
        },
      }),
      {
        name: 'news-storage',
        partialize: (state) => ({
          selectedCategory: state.selectedCategory,
          // Don't persist articles as they should be fresh
        }),
      }
    ),
    {
      name: 'news-store',
    }
  )
);

// Selectors for optimized re-renders
export const useNewsArticles = () => useNewsStore((state) => state.articles);
export const useFeaturedNews = () => useNewsStore((state) => state.featuredArticles);
export const useNewsCategories = () => useNewsStore((state) => ({
  categories: state.categories,
  selectedCategory: state.selectedCategory,
}));
export const useNewsStatus = () => useNewsStore((state) => ({
  isLoading: state.isLoading,
  error: state.error,
  lastUpdated: state.lastUpdated,
  hasMore: state.hasMore,
  page: state.page,
}));
export const useNewsActions = () => useNewsStore((state) => ({
  fetchNews: state.fetchNews,
  fetchFeaturedNews: state.fetchFeaturedNews,
  selectCategory: state.selectCategory,
  loadMore: state.loadMore,
  refreshNews: state.refreshNews,
  clearError: state.clearError,
}));

// Auto-refresh news every 5 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    const store = useNewsStore.getState();
    if (!store.isLoading) {
      store.refreshNews();
    }
  }, 5 * 60 * 1000);
} 