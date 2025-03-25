"use client";

import { ReactNode } from "react";
import { Wallet } from "lucide-react";

interface WalletButtonProps {
  children?: ReactNode;
  onClick?: () => void;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function WalletButton({
  children = "Connect Wallet",
  onClick,
  className = "",
  size = "md",
}: WalletButtonProps) {
  const sizeClasses = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2",
    lg: "px-6 py-3 text-lg",
  };

  const handleButtonClick = () => {
    if (onClick) {
      onClick();
    } else {
      console.log("Wallet button clicked");
      // Modal functionality removed
    }
  };

  return (
    <button
      onClick={handleButtonClick}
      className={`relative group rounded-lg font-medium flex items-center gap-2 transition-all duration-300 ${sizeClasses[size]} ${className}`}
    >
      {/* Transparent background with gradient border */}
      <span className="absolute inset-0 rounded-lg bg-black/30 backdrop-blur-sm"></span>
      <span className="absolute inset-0 rounded-lg border-2 border-[#db74cf] group-hover:border-opacity-100 border-opacity-70 transition-all"></span>

      {/* Subtle glow effect on hover */}
      <span className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-md bg-[#db74cf]/10"></span>

      {/* Content */}
      <span className="relative z-10 flex items-center justify-center gap-2 text-white">
        <Wallet
          className={`text-primary group-hover:text-white transition-colors ${
            size === "sm"
              ? "w-3.5 h-3.5"
              : size === "lg"
                ? "w-5 h-5"
                : "w-4 h-4"
          }`}
        />
        {children}
      </span>
    </button>
  );
}
