"use client";

import { useTranslation } from "@/hooks/useTranslation";

export function MarketTrends() {
  const { t } = useTranslation();
  
  // In a real app, you would use a charting library like Recharts or Chart.js
  return (
    <div className="bg-black/50 backdrop-blur-lg rounded-xl border border-white/10 p-6 h-80">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">{t('market.market_trends')}</h3>
        <select className="bg-black/50 border border-white/10 rounded px-3 py-1 text-sm">
          <option>24H</option>
          <option>7D</option>
          <option>1M</option>
        </select>
      </div>
      <div className="h-full flex items-center justify-center">
        <p className="text-gray-400">
          {t('market.chart_placeholder')}
        </p>
      </div>
    </div>
  );
}
