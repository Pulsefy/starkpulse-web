"use client";

import { Clock, User } from "lucide-react";
import Image from "next/image";
import { NewsCarousel } from "@/components/news-carousel";

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
}

export function NewsSection({ newsData, isLoading, error }: NewsSectionProps) {
  return (
    <div className="bg-black/40 border border-white/10 rounded-xl p-4">
      <h2
        className="text-2xl font-bold mb-4 font-poppins text-white relative z-10 isolation-isolate flex items-center gap-2"
        style={{ opacity: 1, filter: "none" }}
      >
        <span className="w-2 h-6 bg-blue-500 rounded-sm inline-block"></span>
        Latest News
      </h2>

      {isLoading ? (
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
        <div className="text-center text-red-500 py-8">
          {error}
          <button
            className="block mx-auto mt-4 px-4 py-2 bg-primary/20 text-white rounded-lg hover:bg-primary/30 transition-colors"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      ) : (
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
