"use client";

import React from "react";
import { Line } from "react-chartjs-2";
import {
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Wallet,
  Clock,
  Award,
} from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend,
} from "chart.js";

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend
);

export function EarningsDashboard() {
  // Mock data for earnings
  const totalEarnings = 1284.56;
  const earningsChange = 124.35;
  const earningsChangePercent = 10.7;
  const pendingRewards = 42.18;
  const stakingRewards = 876.29;
  const referralRewards = 366.09;

  // Earnings chart data
  const earningsData = {
    labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"],
    datasets: [
      {
        fill: true,
        label: "Earnings",
        data: [120, 190, 170, 250, 230, 320, 380, 350, 410],
        borderColor: "#db74cf",
        backgroundColor: "rgba(219, 116, 207, 0.1)",
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 4,
      },
    ],
  };

  // Earnings chart options
  const earningsOptions = {
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
          callback: function (value: any) {
            return value + " STRK";
          },
        },
      },
    },
    interaction: {
      intersect: false,
      mode: "index" as const,
    },
  };

  // Recent transactions data
  const recentTransactions = [
    {
      type: "Staking Reward",
      amount: 12.45,
      time: "2 hours ago",
      status: "completed",
    },
    {
      type: "Referral Bonus",
      amount: 25.0,
      time: "Yesterday",
      status: "completed",
    },
    {
      type: "Trading Fee Rebate",
      amount: 3.18,
      time: "2 days ago",
      status: "completed",
    },
    {
      type: "Governance Reward",
      amount: 15.72,
      time: "3 days ago",
      status: "completed",
    },
    {
      type: "Liquidity Mining",
      amount: 8.9,
      time: "5 days ago",
      status: "completed",
    },
  ];

  return (
    <div className="space-y-6" style={{ marginTop: "-70px" }}>
      <div className="flex items-center mb-4">
        <h1 className="text-2xl font-bold">Earnings Dashboard</h1>
        <span className="ml-3 text-xs text-gray-400 bg-gray-800/50 px-2 py-0.5 rounded">
          Last updated: Just now
        </span>
      </div>

      <div className="bg-gradient-to-br from-black/50 to-primary/10 backdrop-blur-lg rounded-xl border border-white/10 p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4 sm:gap-0">
          <div className="flex flex-wrap items-center">
            <div className="text-yellow-400 mr-2">⭐</div>
            <h2 className="text-xl sm:text-2xl font-bold">My Earnings</h2>
            <span className="ml-2 sm:ml-3 text-xs sm:text-sm text-gray-400 bg-gray-800/50 px-2 py-0.5 rounded">
              Active
            </span>
          </div>
          <div className="flex space-x-2">
            {/* Fixed Withdraw Button */}
            <div className="inline-block">
              <button className="w-[120px] h-[40px] bg-[#101218] flex items-center justify-center border-none rounded-lg cursor-pointer transition-all duration-300 hover:bg-[#202531] group">
                <span className="w-[40px] h-[40px] flex flex-col items-center justify-center relative">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 60 20"
                    className="w-[40%] z-[3] transition-all duration-300 group-hover:-translate-y-[5px]"
                  >
                    <path
                      strokeLinecap="round"
                      strokeWidth={4}
                      stroke="#db74cf"
                      d="M2 18L58 18"
                    />
                    <circle
                      strokeWidth={5}
                      stroke="#db74cf"
                      fill="#101218"
                      r={7}
                      cy="9.5"
                      cx="20.5"
                    />
                    <circle
                      strokeWidth={5}
                      stroke="#db74cf"
                      fill="#101218"
                      r={7}
                      cy="9.5"
                      cx="38.5"
                    />
                  </svg>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 58 44"
                    className="w-[40%] z-[3]"
                  >
                    <mask id="path-1-inside-1_81_19">
                      <rect rx={3} height={44} width={58} fill="white" />
                    </mask>
                    <rect
                      mask="url(#path-1-inside-1_81_19)"
                      strokeWidth={8}
                      stroke="#db74cf"
                      fill="#101218"
                      rx={3}
                      height={44}
                      width={58}
                    />
                    <line
                      strokeWidth={6}
                      stroke="#db74cf"
                      y2={29}
                      x2={58}
                      y1={29}
                      x1="0"
                    />
                    <path
                      strokeLinecap="round"
                      strokeWidth={5}
                      stroke="#db74cf"
                      d="M45.0005 20L36 3"
                    />
                    <path
                      strokeLinecap="round"
                      strokeWidth={5}
                      stroke="#db74cf"
                      d="M21 3L13.0002 19.9992"
                    />
                  </svg>
                  <span className="w-[25%] h-[25%] bg-[#e4d61a] absolute rounded-full transition-all duration-300 z-[1] border-2 border-[#ffe956] mt-1 group-hover:-translate-y-[5px] group-hover:delay-200"></span>
                </span>
                <span className="w-[70px] h-full text-[13px] text-[#db74cf] flex items-center justify-start font-semibold">
                  Withdraw
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Earnings Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Total Earnings Card */}
          <div className="relative w-full h-[200px] bg-black/20 backdrop-blur-sm rounded-xl overflow-hidden border border-[#db74cf]/10">
            <div className="flex flex-col items-center justify-center h-full p-4">
              <div className="mb-2"></div>
              <p className="text-sm text-gray-400 mb-1">Total Earnings</p>
              <p className="text-3xl font-bold text-[#db74cf]">
                {totalEarnings.toFixed(2)} STRK
              </p>
              <p className="text-sm text-green-400 flex items-center">
                <ArrowUpRight className="w-3 h-3 mr-1" />+
                {earningsChange.toFixed(2)} STRK ({earningsChangePercent}%)
              </p>
              <span className="absolute left-1/2 bottom-3 transform -translate-x-1/2 text-[6px] uppercase text-gray-400">
                lifetime earnings
              </span>
            </div>
          </div>

          {/* Pending Rewards Card */}
          <div className="relative w-full h-[200px] bg-black/20 backdrop-blur-sm rounded-xl overflow-hidden border border-[#db74cf]/10">
            <div className="flex flex-col items-center justify-center h-full p-4">
              <div className="mb-2"></div>
              <p className="text-sm text-gray-400 mb-1">Pending Rewards</p>
              <p className="text-3xl font-bold text-blue-400">
                {pendingRewards.toFixed(2)} STRK
              </p>
              <p className="text-sm text-gray-400 flex items-center">
                <Clock className="w-3 h-3 mr-1" />
                Available in 24 hours
              </p>
              <span className="absolute left-1/2 bottom-3 transform -translate-x-1/2 text-[6px] uppercase text-gray-400">
                unclaimed rewards
              </span>
            </div>
          </div>

          {/* Staking Rewards Card */}
          <div className="relative w-full h-[200px] bg-black/20 backdrop-blur-sm rounded-xl overflow-hidden border border-[#db74cf]/10">
            <div className="flex flex-col items-center justify-center h-full p-4">
              <div className="mb-2"></div>
              <p className="text-sm text-gray-400 mb-1">Staking Rewards</p>
              <p className="text-3xl font-bold text-green-400">
                {stakingRewards.toFixed(2)} STRK
              </p>
              <p className="text-sm text-green-400 flex items-center">
                <TrendingUp className="w-3 h-3 mr-1" />
                68.2% of total earnings
              </p>
              <span className="absolute left-1/2 bottom-3 transform -translate-x-1/2 text-[6px] uppercase text-gray-400">
                staking performance
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="relative w-full bg-black/20 backdrop-blur-sm rounded-xl overflow-hidden p-4 border border-[#db74cf]/20">
            <h3 className="text-lg font-semibold mb-4">Earnings Breakdown</h3>
            <div className="relative h-64">
              <div className="grid grid-cols-1 gap-4">
                <div className="flex justify-between items-center p-3 bg-black/30 rounded-lg">
                  <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-[#db74cf]/20 flex items-center justify-center mr-3">
                      <Award className="w-4 h-4 text-[#db74cf]" />
                    </div>
                    <div>
                      <p className="font-medium">Staking Rewards</p>
                      <p className="text-xs text-gray-400">
                        From STRK token staking
                      </p>
                    </div>
                  </div>
                  <p className="font-bold">${stakingRewards.toFixed(2)} STRK</p>
                </div>

                <div className="flex justify-between items-center p-3 bg-black/30 rounded-lg">
                  <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center mr-3">
                      <TrendingUp className="w-4 h-4 text-blue-500" />
                    </div>
                    <div>
                      <p className="font-medium">Referral Rewards</p>
                      <p className="text-xs text-gray-400">
                        From invited users
                      </p>
                    </div>
                  </div>
                  <p className="font-bold">
                    ${referralRewards.toFixed(2)} STRK
                  </p>
                </div>

                <div className="flex justify-between items-center p-3 bg-black/30 rounded-lg">
                  <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center mr-3">
                      <Wallet className="w-4 h-4 text-green-500" />
                    </div>
                    <div>
                      <p className="font-medium">Articles Reward</p>
                      <p className="text-xs text-gray-400">
                        Premium content & engagement
                      </p>
                    </div>
                  </div>
                  <p className="font-bold">42.18 STRK</p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative w-full bg-black/20 backdrop-blur-sm rounded-xl overflow-hidden p-4 border border-[#db74cf]/20">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Earnings History</h3>
              <div className="flex space-x-2">
                <button className="bg-black/30 hover:bg-black/50 text-white px-2 py-1 rounded text-xs">
                  1M
                </button>
                <button className="bg-transparent hover:bg-black/30 text-gray-400 px-2 py-1 rounded text-xs">
                  3M
                </button>
                <button className="bg-transparent hover:bg-black/30 text-gray-400 px-2 py-1 rounded text-xs">
                  6M
                </button>
                <button className="bg-transparent hover:bg-black/30 text-gray-400 px-2 py-1 rounded text-xs">
                  1Y
                </button>
                <button className="bg-transparent hover:bg-black/30 text-gray-400 px-2 py-1 rounded text-xs">
                  All
                </button>
              </div>
            </div>
            <div className="h-64">
              <Line data={earningsData} options={earningsOptions} />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-gradient-to-br from-black/50 to-primary/10 backdrop-blur-lg rounded-xl border border-white/10 p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Transactions</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-4 py-3 text-left font-medium text-gray-300">
                  Type
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-300">
                  Amount
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-300">
                  Time
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-300">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {recentTransactions.map((tx, index) => (
                <tr
                  key={index}
                  className="border-b border-white/5 hover:bg-white/5"
                >
                  <td className="px-4 py-3">{tx.type}</td>
                  <td className="px-4 py-3 text-right text-green-400">
                    +{tx.amount.toFixed(2)} STRK
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400">
                    {tx.time}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="inline-block px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs">
                      {tx.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
