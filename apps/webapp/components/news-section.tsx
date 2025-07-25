"use client";

import { Clock, User } from "lucide-react";
import Image from "next/image";
import { NewsCarousel } from "@/components/news-carousel";
import { useTranslation } from "@/hooks/useTranslation";

interface NewsData {
  id: number;
  title: string;
  excerpt: string;
  category: string;
  author: string;
  date: string;
  imageUrl: string;
}

interface NewsSectionProps {
  newsData: NewsData[];
  isLoading: boolean;
  error: string | null;
  showAsGrid?: boolean; // New prop to control display mode
}

export function NewsSection({
  newsData,
  isLoading,
  error,
  showAsGrid = false,
}: NewsSectionProps) {
  const { t } = useTranslation();
  
  // Add console log to debug the data
  console.log("News Data:", newsData);

  return (
    <div className="bg-black/40 border border-white/10 rounded-xl p-4">
      <h2
        className="text-2xl font-bold mb-4 font-poppins text-white relative z-10 isolation-isolate flex items-center gap-2"
        style={{ opacity: 1, filter: "none" }}
      >
        <span className="w-2 h-6 bg-blue-500 rounded-sm inline-block"></span>
        {t('news.latest_news')}
      </h2>

      {isLoading ? (
        // Loading state remains the same
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-black/50 border border-white/10 rounded-lg p-4"
            >
              <div className="h-32 bg-white/5 rounded-lg mb-2"></div>
              <div className="h-4 bg-white/5 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-white/5 rounded w-full mb-2"></div>
              <div className="h-3 bg-white/5 rounded w-5/6"></div>
            </div>
          ))}
        </div>
      ) : error ? (
        // Error state remains the same
        <div className="text-center text-red-500 py-8">
          {error}
          <button
            className="block mx-auto mt-4 px-4 py-2 bg-primary/20 text-white rounded-lg hover:bg-primary/30 transition-colors"
            onClick={() => window.location.reload()}
          >
            {t('buttons.retry')}
          </button>
        </div>
      ) : showAsGrid ? (
        // Completely revised grid layout with simpler structure
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {newsData && newsData.length > 0 ? (
            newsData.map((news) => (
              <div
                key={news.id}
                className="bg-black border border-white/20 rounded-lg shadow-lg"
              >
                <div className="relative h-40">
                  <Image
                    src={news.imageUrl}
                    alt={news.title}
                    fill
                    className="object-cover rounded-t-lg"
                  />
                  <div className="absolute top-2 right-2 bg-primary text-white text-xs px-2 py-1 rounded">
                    {news.category}
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="text-lg font-bold text-white mb-2">
                    {news.title || t('news.untitled')}
                  </h3>
                  <p className="text-white/80 text-sm mb-3">
                    {news.excerpt || t('news.no_description')}
                  </p>
                  <div className="flex justify-between items-center text-xs text-white/60">
                    <div className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {news.author || t('news.unknown_author')}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {news.date || t('news.no_date')}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-3 text-center py-8 text-white">
              {t('news.no_news_available')}
            </div>
          )}
        </div>
      ) : (
        // Original carousel view remains unchanged
        <NewsCarousel itemsPerView={3}>
          {newsData.map((news) => (
            <div key={news.id} className="h-full">
              <div className="bg-black/50 border border-white/10 rounded-lg overflow-hidden h-full flex flex-col">
                <div className="relative h-48">
                  <Image
                    src={news.imageUrl}
                    alt={news.title}
                    fill
                    className="object-cover"
                  />
                  <div className="absolute top-2 right-2 bg-primary/90 text-white text-xs px-2 py-1 rounded">
                    {news.category}
                  </div>
                </div>
                <div className="p-4 flex-1 flex flex-col">
                  <h3 className="text-lg font-bold mb-2">{news.title}</h3>
                  <p className="text-gray-300 text-sm mb-4 flex-1">
                    {news.excerpt}
                  </p>
                  <div className="flex justify-between items-center text-xs text-gray-400">
                    <div className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {news.author}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {news.date}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </NewsCarousel>
      )}
    </div>
  );
}
