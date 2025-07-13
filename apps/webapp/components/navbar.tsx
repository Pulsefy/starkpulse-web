"use client";
import { usePathname } from "next/navigation";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import {
  Menu,
  X,
  Layers,
  Users,
  LayoutDashboard,
  UserCircle,
  Bell,
  Search,
} from "lucide-react";
import WalletButton from "./wallet-button";
// Remove the useWallet import since it's causing issues
// import { useWallet } from "@/hooks/use-wallet";
// Change this line:
// import { WalletConnectModal } from "./wallet-connect-modal";

// To this:
import { WalletConnectModal } from "./wallet-connect-model";

export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const pathname = usePathname();
  const isDashboard = pathname?.startsWith("/dashboard");

  // Sample notifications data
  const notifications = [
    {
      id: 1,
      title: "New Staking Rewards",
      message: "You've earned 12.5 STRK from staking",
      time: "2 minutes ago",
      read: false,
    },
    {
      id: 2,
      title: "Price Alert",
      message: "STRK is up 8.2% in the last 24 hours",
      time: "1 hour ago",
      read: false,
    },
    {
      id: 3,
      title: "New Article Published",
      message: "Check out the latest article on Starknet's L2 scaling",
      time: "3 hours ago",
      read: true,
    },
    {
      id: 4,
      title: "Governance Vote",
      message: "New governance proposal is available for voting",
      time: "Yesterday",
      read: true,
    },
  ];

  // Close notifications when clicking outside
  const handleClickOutside = () => {
    setIsNotificationsOpen(false);
  };

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-xl border-b border-[#db74cf]/10"
      style={{ borderBottomWidth: "0.5px" }}
    >
      <div className="container mx-auto px-4 max-w-[1400px]">
        <div className="flex items-center h-20">
          {/* Logo - now always visible */}
          <div className="flex-shrink-0 my-2">
            <Link href="/" className="flex items-center">
              <Image
                src="/assets/starkpulse-03.svg"
                alt="StarkPulse Logo"
                width={40}
                height={40}
                className="h-28 w-auto my-auto"
                priority
              />
            </Link>
          </div>

          {/* Centered Desktop Navigation - only show when not on dashboard */}
          {!isDashboard && (
            <div className="hidden md:flex items-center space-x-8 absolute left-1/2 -translate-x-1/2">
              <Link
                href="/news"
                className="px-3 py-2 text-sm font-medium text-white hover:text-white transition-all flex items-center gap-2 group relative"
              >
                <Layers className="w-4 h-4 text-primary group-hover:text-white transition-colors" />
                <span className="group-hover:translate-x-0.5 transition-transform">
                  Explore
                </span>
                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#db74cf] transform scale-x-0 origin-left transition-transform duration-300 group-hover:scale-x-100"></span>
              </Link>

              {/* Rest of navigation links */}
              <Link
                href="#"
                className="px-3 py-2 text-sm font-medium text-white hover:text-white transition-all flex items-center gap-2 group relative"
              >
                <Users className="w-4 h-4 text-primary group-hover:text-white transition-colors" />
                <span className="group-hover:translate-x-0.5 transition-transform">
                  Community
                </span>
                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#db74cf] transform scale-x-0 origin-left transition-transform duration-300 group-hover:scale-x-100"></span>
              </Link>
              <Link
                href="#"
                className="px-3 py-2 text-sm font-medium text-white hover:text-white transition-all flex items-center gap-2 group relative"
              >
                <LayoutDashboard className="w-4 h-4 text-primary group-hover:text-white transition-colors" />
                <span className="group-hover:translate-x-0.5 transition-transform">
                  Dashboard
                </span>
                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#db74cf] transform scale-x-0 origin-left transition-transform duration-300 group-hover:scale-x-100"></span>
              </Link>
            </div>
          )}

          {/* Dashboard-specific elements - search and notification */}
          {isDashboard && (
            <div className="hidden md:flex items-center space-x-4 ml-8">
              {/* This section will be removed */}
            </div>
          )}

          {/* Right-aligned elements - Modified to ensure proper spacing */}
          <div className="flex items-center gap-4 ml-auto">
            {/* Dashboard-specific elements moved here */}
            {isDashboard && (
              <>
                <div className="hidden md:block relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <Search className="w-4 h-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    className="bg-black/30 border border-white/10 text-white text-sm rounded-lg focus:ring-[#db74cf]/50 focus:border-[#db74cf]/50 block w-64 pl-10 p-2.5"
                    placeholder="Search coins, news..."
                  />
                </div>
                <div className="hidden md:block relative">
                  <button
                    className="relative p-2 text-gray-400 hover:text-white rounded-full hover:bg-white/5"
                    onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                  >
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-1 right-1 w-2 h-2 bg-[#db74cf] rounded-full"></span>
                  </button>

                  {/* Notification Dropdown */}
                  {isNotificationsOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={handleClickOutside}
                      ></div>
                      <div className="absolute right-0 mt-2 w-80 bg-black/95 border border-[#db74cf]/20 rounded-lg shadow-lg overflow-hidden z-50 backdrop-blur-xl">
                        <div className="p-3 border-b border-[#db74cf]/20 flex justify-between items-center">
                          <h3 className="font-medium text-white">
                            Notifications
                          </h3>
                          <span className="text-xs bg-[#db74cf]/20 text-[#db74cf] px-2 py-0.5 rounded-full">
                            {notifications.filter((n) => !n.read).length} new
                          </span>
                        </div>
                        <div className="max-h-96 overflow-y-auto">
                          {notifications.map((notification) => (
                            <div
                              key={notification.id}
                              className={`p-3 border-b border-white/5 hover:bg-white/5 cursor-pointer ${
                                notification.read ? "opacity-70" : ""
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div
                                  className={`w-2 h-2 rounded-full mt-2 ${
                                    notification.read
                                      ? "bg-gray-500"
                                      : "bg-[#db74cf]"
                                  }`}
                                ></div>
                                <div>
                                  <p className="text-sm font-medium text-white">
                                    {notification.title}
                                  </p>
                                  <p className="text-xs text-gray-400 mt-1">
                                    {notification.message}
                                  </p>
                                  <p className="text-xs text-gray-500 mt-1">
                                    {notification.time}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="p-2 border-t border-[#db74cf]/20">
                          <button className="w-full text-center text-xs text-[#db74cf] hover:text-white p-2 transition-colors">
                            View all notifications
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}

            {/* Login Button - Updated with the specified hover color */}
            <div className="hidden md:block">
              <Link
                href="/auth/login"
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white hover:text-[#db74cf] transition-colors"
              >
                <UserCircle className="w-4 h-4" />
                <span>Sign In</span>
              </Link>
            </div>

            {/* Wallet Button - Updated with onClick handler */}
            <div className="hidden md:block">
              {/* Create a fallback implementation to handle when StarknetProvider is not available */}
              <WalletButton onClick={() => setIsWalletModalOpen(true)}>
                CONNECT
              </WalletButton>

              {/* Wallet Connect Modal - Use the local state instead of the hook */}
              <WalletConnectModal
                isOpen={isWalletModalOpen}
                onCloseAction={() => setIsWalletModalOpen(false)}
                onConnectSuccess={(address) =>
                  console.log("Connected:", address)
                }
              />
            </div>

            {/* Hamburger Menu - Now properly right-aligned */}
            <div className="md:hidden ml-auto">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="text-primary p-2 hover:bg-white/5 rounded-lg transition-colors"
              >
                {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isMenuOpen && (
        <div className="md:hidden bg-black/95 border-t border-primary/20 backdrop-blur-xl">
          <div className="container mx-auto px-4 py-4 space-y-2">
            {/* Dashboard-specific mobile search */}
            {isDashboard && (
              <>
                <div className="relative mb-3">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <Search className="w-4 h-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    className="bg-black/30 border border-white/10 text-white text-sm rounded-lg focus:ring-[#db74cf]/50 focus:border-[#db74cf]/50 block w-full pl-10 p-2.5"
                    placeholder="Search coins, news..."
                  />
                </div>
                <Link
                  href="/notifications"
                  className="flex items-center gap-3 p-3 rounded-lg text-white hover:bg-white/5 transition-all relative group"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <Bell className="w-5 h-5 text-primary" />
                  <span>Notifications</span>
                  <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#db74cf] transform scale-x-0 origin-left transition-transform duration-300 group-hover:scale-x-100"></span>
                </Link>
              </>
            )}

            {/* Regular navigation links - only show when not on dashboard */}
            {!isDashboard && (
              <>
                <Link
                  href="/news"
                  className="flex items-center gap-3 p-3 rounded-lg text-white hover:bg-white/5 transition-all relative group"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <Layers className="w-5 h-5 text-primary" />
                  <span>Explore</span>
                  <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#db74cf] transform scale-x-0 origin-left transition-transform duration-300 group-hover:scale-x-100"></span>
                </Link>
                <Link
                  href="#"
                  className="flex items-center gap-3 p-3 rounded-lg text-white hover:bg-white/5 transition-all relative group"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <Users className="w-5 h-5 text-primary" />
                  <span>Community</span>
                  <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#db74cf] transform scale-x-0 origin-left transition-transform duration-300 group-hover:scale-x-100"></span>
                </Link>
                <Link
                  href="#"
                  className="flex items-center gap-3 p-3 rounded-lg text-white hover:bg-white/5 transition-all relative group"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <LayoutDashboard className="w-5 h-5 text-primary" />
                  <span>Dashboard</span>
                  <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#db74cf] transform scale-x-0 origin-left transition-transform duration-300 group-hover:scale-x-100"></span>
                </Link>
              </>
            )}

            {/* Login button in mobile menu - Updated path to the login page */}
            <Link
              href="/auth/login"
              className="flex items-center gap-3 p-3 rounded-lg text-white hover:bg-white/5 transition-all relative group"
              onClick={() => setIsMenuOpen(false)}
            >
              <UserCircle className="w-5 h-5 text-primary" />
              <span>Sign In</span>
              <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#db74cf] transform scale-x-0 origin-left transition-transform duration-300 group-hover:scale-x-100"></span>
            </Link>

            {/* Wallet connect in mobile menu - Updated with onClick handler */}
            <div className="w-full mt-2">
              <WalletButton onClick={() => setIsWalletModalOpen(true)}>
                CONNECT
              </WalletButton>
            </div>
          </div>
        </div>
      )}

      {/* Wallet Connect Modal */}
      <WalletConnectModal
        isOpen={isWalletModalOpen}
        onCloseAction={() => setIsWalletModalOpen(false)}
      />
    </nav>
  );
}
