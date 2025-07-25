"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/sidebar";
import { Navbar } from "@/components/navbar";
import { StarsAnimation } from "@/components/stars-animation";
import { NewsSection } from "@/components/news-section";
import { CryptoTable } from "@/components/crypto-table";
import { PortfolioSummary } from "@/components/portfolio-summary";
import { EarningsDashboard } from "@/components/earnings-dashboard";
import { mockNewsData } from "@/lib/mock-data";
import { useTranslation } from "@/hooks/useTranslation";
import {
  useUIStore,
  useNewsStore,
  useMarketStore,
  usePortfolioStore,
} from "@/store";

export default function Dashboard() {
  const { t } = useTranslation("dashboard");

  // Keep original state structure but sync with stores
  const [activeView, setActiveView] = useState("home");
  const [newsData, setNewsData] = useState(mockNewsData);
  const [isLoadingNews, setIsLoadingNews] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get data from Zustand stores
  const { currentPage, setCurrentPage } = useUIStore();
  const {
    articles,
    isLoading: storeLoadingNews,
    error: newsError,
    fetchNews,
  } = useNewsStore();
  const { cryptoAssets, fetchMarketData } = useMarketStore();
  const { updatePortfolioData } = usePortfolioStore();

  // Sync local state with store
  useEffect(() => {
    if (currentPage !== activeView) {
      setActiveView(currentPage);
    }
  }, [currentPage, activeView]);

  useEffect(() => {
    setIsLoadingNews(storeLoadingNews);
    if (newsError) {
      setError(newsError);
    }
  }, [storeLoadingNews, newsError]);

  useEffect(() => {
    if (articles.length > 0) {
      const convertedNews = articles.map((article) => ({
        id: parseInt(article.id),
        title: article.title,
        excerpt: article.description,
        category: article.category[0] || "General",
        author: article.author,
        date: new Date(article.publishedAt).toLocaleDateString(),
        imageUrl: article.imageUrl || "",
      }));
      setNewsData(convertedNews);
    }
  }, [articles]);

  // Handle sidebar navigation (keep original function but sync with store)
  const handleNavigation = (navItem: string) => {
    console.log("Navigation changed to:", navItem);
    setActiveView(navItem);
    setCurrentPage(navItem);
    console.log("Active view is now:", navItem);
  };

  // Fetch data from stores on component load
  useEffect(() => {
    if (articles.length === 0) {
      fetchNews();
    }
  }, [articles.length, fetchNews]);

  useEffect(() => {
    if (cryptoAssets.length === 0) {
      fetchMarketData();
    }
  }, [cryptoAssets.length, fetchMarketData]);

  useEffect(() => {
    updatePortfolioData();
  }, [updatePortfolioData]);

  // Format number for crypto table
  const formatNumber = (num: number): string => {
    if (num >= 1e9) {
      return (num / 1e9).toFixed(2) + "B";
    } else if (num >= 1e6) {
      return (num / 1e6).toFixed(2) + "M";
    } else if (num >= 1e3) {
      return (num / 1e3).toFixed(2) + "K";
    } else {
      return num.toString();
    }
  };

  return (
    <div className="min-h-screen bg-black text-white relative">
      <div className="fixed inset-0 z-0">
        <StarsAnimation />
      </div>

      <Sidebar
        activeItem={currentPage}
        onNavItemClickAction={handleNavigation}
      />
      <Navbar />

      <div className="ml-20 transition-all duration-300 pt-16 p-6">
        {activeView === "news" ? (
          <NewsSection
            newsData={newsData}
            isLoading={isLoadingNews}
            error={error}
            showAsGrid={true}
          />
        ) : activeView === "market" ? (
          <CryptoTable formatNumberAction={formatNumber} />
        ) : activeView === "portfolio" ? (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold mb-4">{t("portfolio")}</h1>
            <PortfolioSummary />
            {/* You can add more portfolio-related components here */}
          </div>
        ) : activeView === "home" ? (
          <EarningsDashboard />
        ) : (
          <div>
            <h1 className="text-2xl font-bold mb-4">{t("dashboard_home")}</h1>
            <p>{t("welcome_message")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
