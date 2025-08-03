"use client";

import { useEffect, useState } from "react";
import { CryptoTable } from "@/components/crypto-table";
import { NewsSection } from "@/components/news-section";
import type { CryptoData, NewsData } from "@/lib/mock-data";
import { mockCryptoData, mockNewsData } from "@/lib/mock-data";

export default function NewsPage() {
	const [cryptoData, setCryptoData] = useState<CryptoData[]>([]);
	const [newsData, setNewsData] = useState<NewsData[]>([]);
	const [isLoadingCrypto, setIsLoadingCrypto] = useState(true);
	const [isLoadingNews, setIsLoadingNews] = useState(true);
	const [error, setError] = useState<string | null>(null);

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

	// Fetch crypto data
	useEffect(() => {
		const fetchCryptoData = async () => {
			setIsLoadingCrypto(true);
			try {
				// Using mock data for now
				setTimeout(() => {
					setCryptoData(mockCryptoData);
					setIsLoadingCrypto(false);
				}, 800); // Simulate network delay
			} catch (err) {
				console.error("Error fetching crypto data:", err);
				setError("Failed to load cryptocurrency data");
				setIsLoadingCrypto(false);
			}
		};

		fetchCryptoData();
	}, []);

	// Fetch news data
	useEffect(() => {
		const fetchNewsData = async () => {
			setIsLoadingNews(true);
			try {
				// Using mock data for now
				setTimeout(() => {
					setNewsData(mockNewsData);
					setIsLoadingNews(false);
				}, 1000); // Simulate network delay
			} catch (err) {
				console.error("Error fetching news data:", err);
				setError("Failed to load news data");
				setIsLoadingNews(false);
			}
		};

		fetchNewsData();
	}, []);

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
									Cryptocurrency Prices by Market Cap
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
									Retry
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
