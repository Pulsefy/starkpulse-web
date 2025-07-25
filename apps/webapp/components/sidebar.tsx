"use client";

import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/hooks/useTranslation";
import {
  Home,
  LineChart,
  Wallet,
  Newspaper,
  Settings,
  PieChart,
  Bell,
  LogOut,
  Rss,
  FileText,
  Globe,
  BookOpen,
  TrendingUp,
  BarChartHorizontal,
} from "lucide-react";

interface SidebarProps {
  activeItem?: string;
  onNavItemClickAction: (item: string) => void;
}

export function Sidebar({ activeItem, onNavItemClickAction }: SidebarProps) {
  const pathname = usePathname();
  const { t } = useTranslation('dashboard');

  const navItems = [
    {
      name: t('sidebar.home'),
      href: "#",
      icon: Home,
      id: "home",
      onClick: () => onNavItemClickAction("home"),
    },
    {
      name: t('sidebar.market'),
      href: "#",
      icon: TrendingUp,
      id: "market",
      onClick: () => onNavItemClickAction("market"),
    },
    {
      name: t('sidebar.portfolio'),
      href: "#",
      icon: PieChart,
      id: "portfolio",
      onClick: () => onNavItemClickAction("portfolio"),
    },
    {
      name: "Community",
      href: "#",
      icon: Globe,
      id: "community",
      onClick: () => onNavItemClickAction("community"),
    },
    {
      name: "Staking",
      href: "#",
      icon: BarChartHorizontal,
      id: "staking",
      onClick: () => onNavItemClickAction("staking"),
    },
    {
      name: t('sidebar.news'),
      href: "#",
      icon: Rss,
      id: "news",
      onClick: () => onNavItemClickAction("news"),
    },
    { name: t('sidebar.settings'), href: "/settings", icon: Settings, id: "settings" },
  ];

  return (
    <aside className="group fixed inset-y-0 left-0 z-50 h-full w-20 transition-all duration-300 hover:w-64 bg-black/95 backdrop-blur-xl border-r border-white/10 hover:border-[#db74cf]/30 overflow-hidden flex flex-col">
      {/* Logo Container */}
      <div className="flex h-16 items-center justify-center border-b border-white/10 hover:border-primary/30 transition-colors">
        <Link href="/" className="relative flex items-center p-2">
          <Image
            src="/assets/starkpulse-03.svg"
            alt="Logo"
            width={36}
            height={36}
            className="h-8 w-auto transition-transform group-hover:scale-110"
          />
          <span className="absolute left-14 opacity-0 group-hover:opacity-100 text-xl font-bold transition-opacity duration-200">
            Stark<span className="text-primary">Pulse</span>
          </span>
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ name, href, icon: Icon, id, onClick }) => (
          <Link
            key={name}
            href={onClick ? "#" : href}
            onClick={(e) => {
              if (onClick) {
                e.preventDefault();
                onClick();
              }
            }}
            className={cn(
              "flex items-center h-12 rounded-lg px-3 mb-1 transition-all",
              "text-gray-300 hover:bg-gradient-to-r hover:from-[#db74cf]/10 hover:to-transparent",
              "hover:text-[#db74cf] hover:border hover:border-[#db74cf]/20 transition-colors duration-300 ease-in-out",
              "group-hover:justify-start",
              activeItem === id
                ? "bg-primary/20 text-primary border-primary/30"
                : "hover:bg-[#db74cf]/5"
            )}
          >
            <Icon className="w-6 h-6 mr-4 flex-shrink-0" />
            <span className="opacity-0 group-hover:opacity-100 transition-opacity delay-100">
              {name}
            </span>
          </Link>
        ))}
      </nav>

      {/* Logout Button - Moved to bottom */}
      <div className="px-3 pb-6 mt-auto">
        <Link
          href="/"
          className={cn(
            "flex items-center h-12 rounded-lg px-3",
            "text-red-300 hover:text-red-400 transition-colors",
            "hover:bg-gradient-to-r hover:from-red-500/10 hover:to-transparent"
          )}
        >
          <LogOut className="w-6 h-6 mr-4 flex-shrink-0" />
          <span className="opacity-0 group-hover:opacity-100 transition-opacity delay-100">
            Logout
          </span>
        </Link>
      </div>
    </aside>
  );
}
