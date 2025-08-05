"use client";

import { TrendingUp, TrendingDown, Star } from "lucide-react";
import { useState } from "react";
import Image from "next/image";

interface CryptoData {
  id: number;
  name: string;
  symbol: string;
  icon: string;
  price: number;
  change1h: number;
  change24h: number;
  change7d: number;
  volume24h: number;
  marketCap: number;
  sparkline: number[];
}

interface CryptoTableProps {
  formatNumberAction: (num: number) => string;
}

// Mock data for top 20 cryptocurrencies
const mockCryptoData: CryptoData[] = [
  {
    id: 1,
    name: "Bitcoin",
    symbol: "BTC",
    icon: "/crypto-icons/btc.png",
    price: 84127.12,
    change1h: 0.0,
    change24h: 3.8,
    change7d: -2.9,
    volume24h: 29483607871,
    marketCap: 1669278945761,
    sparkline: [65, 59, 80, 81, 56, 55, 40, 60, 70, 45, 50, 55, 70, 75, 65],
  },
  {
    id: 2,
    name: "Ethereum",
    symbol: "ETH",
    icon: "/crypto-icons/eth.png",
    price: 1913.53,
    change1h: -0.3,
    change24h: 2.5,
    change7d: -10.5,
    volume24h: 12779703866,
    marketCap: 230861090232,
    sparkline: [70, 65, 60, 65, 55, 40, 45, 60, 75, 60, 50, 55, 65, 70, 60],
  },
  {
    id: 3,
    name: "Tether",
    symbol: "USDT",
    icon: "/crypto-icons/usdt.png",
    price: 1.0,
    change1h: 0.0,
    change24h: 0.0,
    change7d: 0.0,
    volume24h: 48731753230,
    marketCap: 143349424457,
    sparkline: [
      100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100,
    ],
  },
  {
    id: 4,
    name: "XRP",
    symbol: "XRP",
    icon: "/crypto-icons/xrp.png",
    price: 2.36,
    change1h: 0.2,
    change24h: 5.3,
    change7d: -0.6,
    volume24h: 3717621302,
    marketCap: 137249574105,
    sparkline: [50, 55, 60, 55, 45, 50, 55, 60, 65, 60, 55, 50, 60, 65, 60],
  },
  {
    id: 5,
    name: "BNB",
    symbol: "BNB",
    icon: "/crypto-icons/bnb.png",
    price: 589.29,
    change1h: 0.3,
    change24h: 1.8,
    change7d: -0.8,
    volume24h: 827850925,
    marketCap: 85930064774,
    sparkline: [60, 65, 70, 65, 55, 50, 55, 60, 65, 60, 55, 50, 60, 65, 60],
  },
  {
    id: 6,
    name: "Solana",
    symbol: "SOL",
    icon: "/crypto-icons/sol.png",
    price: 133.38,
    change1h: -0.5,
    change24h: 8.2,
    change7d: -4.0,
    volume24h: 3642671111,
    marketCap: 68188540632,
    sparkline: [55, 60, 65, 60, 50, 45, 50, 55, 60, 55, 50, 45, 55, 60, 55],
  },
  {
    id: 7,
    name: "USDC",
    symbol: "USDC",
    icon: "/crypto-icons/usdc.png",
    price: 0.9999,
    change1h: 0.0,
    change24h: 0.0,
    change7d: 0.0,
    volume24h: 4710256942,
    marketCap: 58579418503,
    sparkline: [
      100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100,
    ],
  },
  {
    id: 8,
    name: "Cardano",
    symbol: "ADA",
    icon: "/crypto-icons/ada.png",
    price: 0.45,
    change1h: 0.1,
    change24h: 2.3,
    change7d: -5.2,
    volume24h: 289456123,
    marketCap: 15876543210,
    sparkline: [45, 50, 55, 50, 40, 35, 40, 45, 50, 45, 40, 35, 45, 50, 45],
  },
  {
    id: 9,
    name: "Dogecoin",
    symbol: "DOGE",
    icon: "/crypto-icons/doge.png",
    price: 0.12,
    change1h: 0.5,
    change24h: 3.7,
    change7d: -2.1,
    volume24h: 567891234,
    marketCap: 16789123456,
    sparkline: [40, 45, 50, 45, 35, 30, 35, 40, 45, 40, 35, 30, 40, 45, 40],
  },
  {
    id: 10,
    name: "Polkadot",
    symbol: "DOT",
    icon: "/crypto-icons/dot.png",
    price: 6.78,
    change1h: -0.2,
    change24h: 1.5,
    change7d: -3.8,
    volume24h: 234567890,
    marketCap: 8765432109,
    sparkline: [50, 55, 60, 55, 45, 40, 45, 50, 55, 50, 45, 40, 50, 55, 50],
  },
  // Additional cryptocurrencies to make up the top 20
  {
    id: 11,
    name: "Polygon",
    symbol: "MATIC",
    icon: "/crypto-icons/matic.png",
    price: 0.58,
    change1h: 0.3,
    change24h: 2.8,
    change7d: -4.5,
    volume24h: 345678901,
    marketCap: 5678901234,
    sparkline: [55, 60, 65, 60, 50, 45, 50, 55, 60, 55, 50, 45, 55, 60, 55],
  },
  {
    id: 12,
    name: "Shiba Inu",
    symbol: "SHIB",
    icon: "/crypto-icons/shib.png",
    price: 0.000018,
    change1h: 0.7,
    change24h: 4.2,
    change7d: -1.9,
    volume24h: 456789012,
    marketCap: 10123456789,
    sparkline: [60, 65, 70, 65, 55, 50, 55, 60, 65, 60, 55, 50, 60, 65, 60],
  },
  {
    id: 13,
    name: "Avalanche",
    symbol: "AVAX",
    icon: "/crypto-icons/avax.png",
    price: 28.45,
    change1h: -0.4,
    change24h: 3.1,
    change7d: -6.2,
    volume24h: 567890123,
    marketCap: 10234567890,
    sparkline: [65, 70, 75, 70, 60, 55, 60, 65, 70, 65, 60, 55, 65, 70, 65],
  },
  {
    id: 14,
    name: "Chainlink",
    symbol: "LINK",
    icon: "/crypto-icons/link.png",
    price: 13.67,
    change1h: 0.2,
    change24h: 2.9,
    change7d: -3.5,
    volume24h: 678901234,
    marketCap: 7890123456,
    sparkline: [50, 55, 60, 55, 45, 40, 45, 50, 55, 50, 45, 40, 50, 55, 50],
  },
  {
    id: 15,
    name: "Uniswap",
    symbol: "UNI",
    icon: "/crypto-icons/uni.png",
    price: 7.23,
    change1h: 0.1,
    change24h: 1.7,
    change7d: -4.8,
    volume24h: 789012345,
    marketCap: 5432109876,
    sparkline: [45, 50, 55, 50, 40, 35, 40, 45, 50, 45, 40, 35, 45, 50, 45],
  },
  {
    id: 16,
    name: "Litecoin",
    symbol: "LTC",
    icon: "/crypto-icons/ltc.png",
    price: 68.92,
    change1h: -0.3,
    change24h: 2.2,
    change7d: -5.1,
    volume24h: 890123456,
    marketCap: 5098765432,
    sparkline: [55, 60, 65, 60, 50, 45, 50, 55, 60, 55, 50, 45, 55, 60, 55],
  },
  {
    id: 17,
    name: "Bitcoin Cash",
    symbol: "BCH",
    icon: "/crypto-icons/bch.png",
    price: 342.18,
    change1h: 0.4,
    change24h: 3.5,
    change7d: -2.7,
    volume24h: 901234567,
    marketCap: 6789012345,
    sparkline: [60, 65, 70, 65, 55, 50, 55, 60, 65, 60, 55, 50, 60, 65, 60],
  },
  {
    id: 18,
    name: "Cosmos",
    symbol: "ATOM",
    icon: "/crypto-icons/atom.png",
    price: 7.89,
    change1h: -0.2,
    change24h: 1.9,
    change7d: -4.3,
    volume24h: 123456789,
    marketCap: 3456789012,
    sparkline: [50, 55, 60, 55, 45, 40, 45, 50, 55, 50, 45, 40, 50, 55, 50],
  },
  {
    id: 19,
    name: "Stellar",
    symbol: "XLM",
    icon: "/crypto-icons/xlm.png",
    price: 0.11,
    change1h: 0.3,
    change24h: 2.6,
    change7d: -3.2,
    volume24h: 234567890,
    marketCap: 3210987654,
    sparkline: [45, 50, 55, 50, 40, 35, 40, 45, 50, 45, 40, 35, 45, 50, 45],
  },
  {
    id: 20,
    name: "Monero",
    symbol: "XMR",
    icon: "/crypto-icons/xmr.png",
    price: 178.56,
    change1h: 0.1,
    change24h: 1.4,
    change7d: -3.9,
    volume24h: 345678901,
    marketCap: 3109876543,
    sparkline: [55, 60, 65, 60, 50, 45, 50, 55, 60, 55, 50, 45, 55, 60, 55],
  },
];

export function CryptoTable({ formatNumberAction }: CryptoTableProps) {
  const [cryptoData] = useState<CryptoData[]>(mockCryptoData);
  const [isLoading] = useState<boolean>(false);
  const [error] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<number[]>([]);

  const toggleFavorite = (id: number) => {
    if (favorites.includes(id)) {
      setFavorites(favorites.filter((favId) => favId !== id));
    } else {
      setFavorites([...favorites, id]);
    }
  };

  // Function to render sparkline chart
  const renderSparkline = (data: number[], isPositive: boolean) => {
    const height = 40;
    const width = 120;
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;

    const points = data
      .map((value, index) => {
        const x = (index / (data.length - 1)) * width;
        const y = height - ((value - min) / range) * height;
        return `${x},${y}`;
      })
      .join(" ");

    return (
      <svg width={width} height={height} className="overflow-visible">
        <polyline
          points={points}
          fill="none"
          stroke={isPositive ? "#22c55e" : "#ef4444"}
          strokeWidth="1.5"
        />
      </svg>
    );
  };

  return (
    <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-xl p-4 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold font-poppins text-white flex items-center gap-2">
          <span className="w-2 h-6 bg-blue-500 rounded-sm"></span>
          Cryptocurrency Market Cap
          {/* <span className="text-sm text-gray-400 ml-2 font-normal">
            Top {cryptoData.length}
          </span> */}
        </h2>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-pulse flex space-x-4">
            <div className="rounded-full bg-white/10 h-12 w-12"></div>
            <div className="flex-1 space-y-4 py-1">
              <div className="h-4 bg-white/10 rounded w-3/4"></div>
              <div className="space-y-2">
                <div className="h-4 bg-white/10 rounded"></div>
                <div className="h-4 bg-white/10 rounded w-5/6"></div>
              </div>
            </div>
          </div>
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
        <div
          className="overflow-x-auto max-h-[600px] overflow-y-auto"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          <style jsx>{`
            div::-webkit-scrollbar {
              display: none;
            }
          `}</style>
          <table className="w-full">
            <thead className="sticky top-0 bg-black/90 backdrop-blur-md z-10">
              <tr className="border-b border-white/10 text-left">
                <th className="pb-3 pl-2 w-10"></th>
                <th className="pb-3 pl-2 w-10">#</th>
                <th className="pb-3">Coin</th>
                <th className="pb-3 text-right">Price</th>
                <th className="pb-3 text-right">1h</th>
                <th className="pb-3 text-right">24h</th>
                <th className="pb-3 text-right">7d</th>
                <th className="pb-3 text-right">24h Volume</th>
                <th className="pb-3 text-right">Market Cap</th>
                <th className="pb-3 text-right pr-4">Last 7 Days</th>
              </tr>
            </thead>
            <tbody>
              {cryptoData.map((crypto) => (
                <tr
                  key={crypto.id}
                  className="border-b border-white/5 hover:bg-gradient-to-r hover:from-blue-500/20 hover:to-purple-500/20 transition-all duration-200"
                >
                  <td className="py-4 pl-2">
                    <button
                      onClick={() => toggleFavorite(crypto.id)}
                      className="focus:outline-none transition-colors duration-200"
                    >
                      <Star
                        size={16}
                        className={
                          favorites.includes(crypto.id)
                            ? "text-yellow-400 fill-yellow-400"
                            : "text-gray-500 group-hover:text-white hover:text-yellow-400 transition-colors duration-200"
                        }
                      />
                    </button>
                  </td>
                  <td className="py-4 pl-2 text-gray-400 group-hover:text-white">
                    {crypto.id}
                  </td>
                  <td className="py-4">
                    <div className="flex items-center gap-2">
                      {crypto.icon ? (
                        <div className="relative w-8 h-8 rounded-full bg-gradient-to-r from-blue-500/20 to-purple-500/20 p-0.5">
                          <Image
                            src={crypto.icon}
                            alt={crypto.name}
                            width={24}
                            height={24}
                            className="rounded-full w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500/20 to-purple-500/20 flex items-center justify-center text-xs font-bold">
                          {crypto.symbol.substring(0, 2)}
                        </div>
                      )}
                      <div>
                        <div className="font-medium">{crypto.name}</div>
                        <div className="text-xs text-gray-400">
                          {crypto.symbol}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 text-right font-medium">
                    <span className="font-mono">
                      $
                      {crypto.price.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </td>
                  <td className="py-4 text-right">
                    <span
                      className={`px-2 py-1 rounded-md ${
                        crypto.change1h >= 0
                          ? "bg-green-500/10 text-green-500"
                          : "bg-red-500/10 text-red-500"
                      }`}
                    >
                      {crypto.change1h >= 0 ? "+" : ""}
                      {crypto.change1h.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-4 text-right">
                    <span
                      className={`px-2 py-1 rounded-md ${
                        crypto.change24h >= 0
                          ? "bg-green-500/10 text-green-500"
                          : "bg-red-500/10 text-red-500"
                      }`}
                    >
                      {crypto.change24h >= 0 ? "+" : ""}
                      {crypto.change24h.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-4 text-right">
                    <span
                      className={`px-2 py-1 rounded-md ${
                        crypto.change7d >= 0
                          ? "bg-green-500/10 text-green-500"
                          : "bg-red-500/10 text-red-500"
                      }`}
                    >
                      {crypto.change7d >= 0 ? "+" : ""}
                      {crypto.change7d.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-4 text-right font-mono">
                    ${formatNumberAction(crypto.volume24h)}
                  </td>
                  <td className="py-4 text-right font-mono">
                    ${formatNumberAction(crypto.marketCap)}
                  </td>
                  <td className="py-4 text-right pr-4">
                    {renderSparkline(crypto.sparkline, crypto.change7d >= 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
