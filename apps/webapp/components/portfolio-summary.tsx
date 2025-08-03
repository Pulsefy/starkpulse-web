"use client";

import {
	ArcElement,
	CategoryScale,
	Chart as ChartJS,
	Filler,
	Legend,
	LinearScale,
	LineElement,
	PointElement,
	TimeScale,
	Title,
	Tooltip,
} from "chart.js";
import { PlusIcon } from "lucide-react";
import React from "react";
import { Doughnut, Line } from "react-chartjs-2";
import { PortfolioCoinsTable } from "./portfolio-coins-table";

// Register ChartJS components
ChartJS.register(
	CategoryScale,
	LinearScale,
	PointElement,
	LineElement,
	Title,
	Tooltip,
	Filler,
	Legend,
	ArcElement,
	TimeScale,
);

export function PortfolioSummary() {
	// Mock data for the portfolio
	const portfolioValue = 82.9;
	const portfolioChange = 4.41;
	const portfolioChangePercent = 5.6;
	const totalLoss = -98.04;
	const totalLossPercent = -54.2;
	const topGainer = { name: "Energy Web", symbol: "EWT", change: 0.0 };

	// Performance chart data
	const performanceData = {
		labels: ["12:00", "16:00", "20:00", "10. Apr", "04:00", "08:00"],
		datasets: [
			{
				fill: true,
				label: "Portfolio Value",
				data: [75, 78, 82, 85, 83, 82],
				borderColor: "#4ade80",
				backgroundColor: "rgba(74, 222, 128, 0.1)",
				tension: 0.4,
				pointRadius: 0,
				pointHoverRadius: 4,
			},
		],
	};

	// Performance chart options
	const performanceOptions = {
		responsive: true,
		maintainAspectRatio: false,
		plugins: {
			legend: {
				display: false,
			},
			tooltip: {
				mode: "index" as const,
				intersect: false,
				backgroundColor: "rgba(0, 0, 0, 0.8)",
				titleColor: "#fff",
				bodyColor: "#fff",
				borderColor: "rgba(255, 255, 255, 0.1)",
				borderWidth: 1,
			},
		},
		scales: {
			x: {
				grid: {
					display: false,
				},
				ticks: {
					color: "rgba(255, 255, 255, 0.5)",
					font: {
						size: 10,
					},
				},
			},
			y: {
				grid: {
					color: "rgba(255, 255, 255, 0.05)",
				},
				ticks: {
					color: "rgba(255, 255, 255, 0.5)",
					font: {
						size: 10,
					},
					callback: (value: any) => "$" + value,
				},
				min: 70,
				max: 95,
			},
		},
		interaction: {
			intersect: false,
			mode: "index" as const,
		},
	};

	// Holdings chart data
	const holdingsData = {
		labels: ["STRK"],
		datasets: [
			{
				data: [100],
				backgroundColor: ["#db74cf"],
				borderWidth: 0,
				cutout: "70%",
			},
		],
	};

	// Holdings chart options
	const holdingsOptions = {
		responsive: true,
		maintainAspectRatio: false,
		plugins: {
			legend: {
				display: false,
			},
			tooltip: {
				enabled: true,
				callbacks: {
					label: (context: any) => context.label + ": " + context.raw + "%",
				},
			},
		},
	};

	return (
		<div className="space-y-6" style={{ marginTop: "-70px" }}>
			{/* Portfolio Navigation Tabs */}
			<div className="flex items-center mb-4">
				<button className="text-gray-400 hover:text-white px-4 py-2 text-sm font-medium">
					Overview
				</button>
				<button className="bg-lime-400/20 text-lime-400 px-4 py-2 rounded-lg text-sm font-medium flex items-center">
					<span className="text-yellow-400 mr-2">⭐</span>
					My Portfolio
				</button>
				<button className="ml-2 text-gray-400 hover:text-white px-4 py-2 text-sm font-medium flex items-center">
					<PlusIcon className="w-4 h-4 mr-1" />
					New Portfolio
				</button>
			</div>

			<div className="bg-gradient-to-br from-black/50 to-primary/10 backdrop-blur-lg rounded-xl border border-white/10 p-6">
				<div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4 sm:gap-0">
					<div className="flex flex-wrap items-center">
						<div className="text-yellow-400 mr-2">⭐</div>
						<h2 className="text-xl sm:text-2xl font-bold">My Portfolio</h2>
						<span className="ml-2 sm:ml-3 text-xs sm:text-sm text-gray-400 bg-gray-800/50 px-2 py-0.5 rounded">
							Default
						</span>
					</div>
					<div className="flex space-x-2">
						<button className="flex items-center font-medium cursor-pointer text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-gradient-to-b from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 shadow-lg shadow-green-600/30 transition-all text-xs sm:text-sm">
							<PlusIcon className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-1.5" />
							<span>Add coin</span>
						</button>
					</div>
				</div>

				{/* Stylized Cards for Financial Data */}
				<div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
					{/* Current Balance Card */}
					<div className="relative w-full h-[200px] bg-black/20 backdrop-blur-sm rounded-xl overflow-hidden border border-[#db74cf]/10">
						<div className="flex flex-col items-center justify-center h-full p-4">
							<div className="mb-2"></div>
							<p className="text-sm text-gray-400 mb-1">Current Balance</p>
							<p className="text-3xl font-bold text-green-400">
								${portfolioValue.toFixed(2)}
							</p>
							<span className="absolute left-1/2 bottom-3 transform -translate-x-1/2 text-[6px] uppercase text-gray-400">
								pulse finance
							</span>
						</div>
					</div>

					{/* 24h Portfolio Change Card */}
					<div className="relative w-full h-[200px] bg-black/20 backdrop-blur-sm rounded-xl overflow-hidden border border-[#db74cf]/10">
						<div className="flex flex-col items-center justify-center h-full p-4">
							<div className="mb-2"></div>
							<p className="text-sm text-gray-400 mb-1">24h Portfolo Change</p>
							<p className="text-3xl font-bold text-green-400">
								+${portfolioChange.toFixed(2)}
							</p>
							<p className="text-sm text-green-400">
								↑ {portfolioChangePercent}%
							</p>
							<span className="absolute left-1/2 bottom-3 transform -translate-x-1/2 text-[6px] uppercase text-gray-400">
								daily growth
							</span>
						</div>
					</div>

					{/* Total Profit/Loss Card */}
					<div className="relative w-full h-[200px] bg-black/20 backdrop-blur-sm rounded-xl overflow-hidden border border-[#db74cf]/10">
						<div className="flex flex-col items-center justify-center h-full p-4">
							<div className="mb-2"></div>
							<p className="text-sm text-gray-400 mb-1">Total Profit Loss</p>
							<p className="text-3xl font-bold text-red-400">
								${totalLoss.toFixed(2)}
							</p>
							<p className="text-sm text-red-400">↓ {totalLossPercent}%</p>
							<span className="absolute left-1/2 bottom-3 transform -translate-x-1/2 text-[6px] uppercase text-gray-400">
								overall performance
							</span>
						</div>
					</div>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
					<div className="relative w-full bg-black/20 backdrop-blur-sm rounded-xl overflow-hidden p-4 border border-[#db74cf]/20">
						<h3 className="text-lg font-semibold mb-4">Holdings</h3>
						<div className="relative h-64">
							<Doughnut data={holdingsData} options={holdingsOptions} />
							<div className="absolute inset-0 flex items-center justify-center flex-col">
								<div className="text-sm text-gray-400">STRK</div>
								<div className="text-lg font-bold">100.00%</div>
							</div>
						</div>
					</div>
					<div className="relative w-full bg-black/20 backdrop-blur-sm rounded-xl overflow-hidden p-4 border border-[#db74cf]/20">
						<div className="flex justify-between items-center mb-4">
							<h3 className="text-lg font-semibold">Performance</h3>
							<div className="flex space-x-2">
								<button className="bg-black/30 hover:bg-black/50 text-white px-2 py-1 rounded text-xs">
									24h
								</button>
								<button className="bg-transparent hover:bg-black/30 text-gray-400 px-2 py-1 rounded text-xs">
									7d
								</button>
								<button className="bg-transparent hover:bg-black/30 text-gray-400 px-2 py-1 rounded text-xs">
									1m
								</button>
								<button className="bg-transparent hover:bg-black/30 text-gray-400 px-2 py-1 rounded text-xs">
									3m
								</button>
								<button className="bg-transparent hover:bg-black/30 text-gray-400 px-2 py-1 rounded text-xs">
									1y
								</button>
							</div>
						</div>
						<div className="h-64">
							<Line data={performanceData} options={performanceOptions} />
						</div>
					</div>
				</div>
			</div>

			{/* Portfolio Coins Table Component */}
			<PortfolioCoinsTable />
		</div>
	);
}
