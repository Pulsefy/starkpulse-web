"use client";

import { useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { Navbar } from "@/components/navbar";
import { StarsAnimation } from "@/components/stars-animation";
import { NewsSection } from "@/components/news-section";
import { CryptoTable } from "@/components/crypto-table";
import { PortfolioSummary } from "@/components/portfolio-summary";
import { EarningsDashboard } from "@/components/earnings-dashboard";
import { mockNewsData } from "@/lib/mock-data";

export default function Dashboard() {
  const [activeView, setActiveView] = useState("home");
  const [newsData] = useState(mockNewsData);
  const [isLoadingNews, setIsLoadingNews] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle sidebar navigation
  const handleNavigation = (navItem: string) => {
    console.log("Navigation changed to:", navItem);
    setActiveView(navItem);
    // Debug statement
    console.log("Active view is now:", navItem);
  };

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
        activeItem={activeView}
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
            <h1 className="text-2xl font-bold mb-4">Portfolio</h1>
            <PortfolioSummary />
            {/* You can add more portfolio-related components here */}
          </div>
        ) : activeView === "home" ? (
          <EarningsDashboard />
        ) : (
          <div>
            <h1 className="text-2xl font-bold mb-4">Dashboard Home</h1>
            <p>Welcome to StarkPulse Dashboard</p>
          </div>
        )}
      </div>
    </div>
  );
}
