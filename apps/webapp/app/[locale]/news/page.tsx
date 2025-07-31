"use client";

import { useState, useEffect } from "react";
import { mockCryptoData, mockNewsData } from "@/lib/mock-data";
import type { CryptoData, NewsData } from "@/lib/mock-data";
import { CryptoTable } from "@/components/crypto-table";
import { NewsSection } from "@/components/news-section";
import { useTranslation } from "@/hooks/useTranslation";
import { useMarketStore, useNewsStore } from "@/store";

export default function NewsPage() {
  const { t } = useTranslation('news');

  // Keep original state structure but populate from stores
  const [cryptoData, setCryptoData] = useState<CryptoData[]>([]);
  const [newsData, setNewsData] = useState<NewsData[]>([]);
  const [isLoadingCrypto, setIsLoadingCrypto] = useState(true);
  const [isLoadingNews, setIsLoadingNews] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get data from Zustand stores
  const { cryptoAssets, isLoading: storeLoadingCrypto, error: cryptoError, fetchMarketData } = useMarketStore();
  const { articles, isLoading: storeLoadingNews, error: newsError, fetchNews } = useNewsStore();

  // Format large numbers
  const formatNumber = (num: number) => {
    if (num >= 1000000000000) {
      return `${(num / 1000000000000).toFixed(2)}T`;
    } else if (num >= 1000000000) {
      return `${(num / 1000000000).toFixed(2)}B`;
    } else if (num >= 1000000) {
      return `${(num / 1000000).toFixed(2)}M`;
    } else {
      return `${num.toFixed(2)}`;
    }
  };

  // Fetch crypto data from store
  useEffect(() => {
    const fetchCryptoData = async () => {
      setIsLoadingCrypto(true);
      try {
        if (cryptoAssets.length === 0) {
          await fetchMarketData();
        }
        // Convert store data to expected format
        const convertedData = cryptoAssets.map(asset => ({
          id: parseInt(asset.id),
          name: asset.name,
          symbol: asset.symbol,
          price: asset.price,
          change24h: asset.change24h,
          marketCap: asset.marketCap,
          volume24h: asset.volume24h,
          circulatingSupply: asset.circulatingSupply,
        }));
        setCryptoData(convertedData);
        setIsLoadingCrypto(false);
      } catch (err) {
        console.error("Error fetching crypto data:", err);
        setError(t('loading_error'));
        setIsLoadingCrypto(false);
      }
    };

    fetchCryptoData();
  }, [cryptoAssets, fetchMarketData, t]);

  useEffect(() => {
    const fetchNewsData = async () => {
      setIsLoadingNews(true);
      try {
        if (articles.length === 0) {
          await fetchNews();
        }
        // Convert store data to expected format
        const convertedNews = articles.map(article => ({
          id: parseInt(article.id),
          title: article.title,
          excerpt: article.description,
          category: article.category[0] || 'General',
          author: article.author,
          date: new Date(article.publishedAt).toLocaleDateString(),
          imageUrl: article.imageUrl || '',
        }));
        setNewsData(convertedNews);
        setIsLoadingNews(false);
      } catch (err) {
        console.error("Error fetching news data:", err);
        setError(t('news_loading_error'));
        setIsLoadingNews(false);
      }
    };

    fetchNewsData();
  }, [articles, fetchNews, t]);

  // Update loading states from stores
  useEffect(() => {
    setIsLoadingCrypto(storeLoadingCrypto);
  }, [storeLoadingCrypto]);

  useEffect(() => {
    setIsLoadingNews(storeLoadingNews);
  }, [storeLoadingNews]);

  // Update error state from stores
  useEffect(() => {
    if (cryptoError || newsError) {
      setError(cryptoError || newsError);
    }
  }, [cryptoError, newsError]);

  return (
    <div className="bg-background pt-20">
      <div className="container mx-auto px-4 py-4">
        {/* Crypto Market Rankings (full width) */}
        <div className="w-full mb-6">
          {isLoadingCrypto ? (
            <div className="bg-black/40 border border-white/10 rounded-xl p-4 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2
                  className="text-2xl font-bold font-poppins text-white relative z-10 isolation-isolate"
                  style={{ opacity: 1, filter: "none" }}
                >
                  {t('page_title')}
                </h2>
              </div>
              <div className="flex justify-center items-center h-64">
                <div className="flex space-x-4">
                  <div className="rounded-full bg-white/5 h-12 w-12"></div>
                  <div className="flex-1 space-y-4 py-1">
                    <div className="h-4 bg-white/5 rounded w-3/4"></div>
                    <div className="space-y-2">
                      <div className="h-4 bg-white/5 rounded"></div>
                      <div className="h-4 bg-white/5 rounded w-5/6"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : error ? (
            <div className="bg-black/40 border border-white/10 rounded-xl p-4 mb-6">
              <div className="text-center text-red-500 py-8">
                {error}
                <button
                  className="block mx-auto mt-4 px-4 py-2 bg-primary/20 text-white rounded-lg hover:bg-primary/30 transition-colors"
                  onClick={() => window.location.reload()}
                >
                  {t('retry_button')}
                </button>
              </div>
            </div>
          ) : (
            <CryptoTable formatNumberAction={formatNumber} />
          )}
        </div>
        {/* End of Crypto Market Rankings */}

        {/* News Section (full width) */}
        <div className="w-full">
          <NewsSection
            newsData={newsData}
            isLoading={isLoadingNews}
            error={error}
          />
        </div>
      </div>
    </div>
  );
}
