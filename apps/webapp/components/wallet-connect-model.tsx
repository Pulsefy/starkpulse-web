"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { X, ExternalLink, AlertCircle } from "lucide-react";
import { createPortal } from "react-dom";
import { useConnect, useAccount } from "@starknet-react/core";

// Import the WalletButton component
import WalletButton from "./wallet-button";

interface WalletConnectModalProps {
  isOpen: boolean;
  onCloseAction: () => void;
  onConnectSuccess?: (address: string) => void;
}

export function WalletConnectModal({
  isOpen,
  onCloseAction,
  onConnectSuccess,
}: WalletConnectModalProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { connect, connectors } = useConnect();
  const { address } = useAccount();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // If address changes and we have an address, call onConnectSuccess
  useEffect(() => {
    if (address && onConnectSuccess) {
      onConnectSuccess(address);
      onCloseAction();
    }
  }, [address, onConnectSuccess, onCloseAction]);

  const handleConnectWallet = async () => {
    setConnecting(true);
    setError(null);

    try {
      // Find the Argent connector with more flexible matching
      const argentConnector = connectors.find((c) => 
        c.id === "argentX" || c.id === "argent" || c.name?.toLowerCase().includes("argent")
      );

      if (!argentConnector) {
        setError("Argent X wallet not found. Please install it first.");
        setConnecting(false);
        return;
      }

      // Connect using the Argent connector
      await connect({ connector: argentConnector });

      // The useEffect above will handle success
      setConnecting(false);
    } catch (err: any) {
      console.error("Error connecting wallet:", err);
      setError(err.message || "Failed to connect. Please try again.");
      setConnecting(false);
    }
  };

  // Don't render anything on server-side
  if (!isMounted) return null;

  if (!isOpen) return null;

  // Use React Portal to render the modal at the document body level
  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onCloseAction}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md p-6 mx-4 overflow-hidden rounded-2xl bg-gradient-to-br from-[#161a25] to-[#0c0e14] border border-[#db74cf]/20 shadow-2xl">
        {/* Close button */}
        <button
          onClick={onCloseAction}
          className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-white">Connect Wallet</h2>
          <p className="text-sm text-white/60 mt-1">
            Connect your Starknet wallet to continue
          </p>
        </div>

        {/* Wallet option - Updated with real connection */}
        <div
          className={`relative p-4 rounded-xl border border-[#db74cf]/30 bg-black/20 backdrop-blur-md transition-all duration-300 hover:border-[#db74cf]/60 ${connecting ? "animate-pulse" : ""} cursor-pointer`}
          onClick={!connecting ? handleConnectWallet : undefined}
        >
          <div className="flex items-center gap-4">
            <div className="relative w-12 h-12 flex-shrink-0">
              <Image
                src="/assets/argent.svg"
                alt="Argent X"
                width={48}
                height={48}
                className="rounded-lg"
              />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-white">Argent X</h3>
              <p className="text-xs text-white/60">The Starknet wallet</p>
            </div>
            <div className="flex-shrink-0">
              {connecting ? (
                <div className="w-5 h-5 border-2 border-[#db74cf] border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <ExternalLink size={18} className="text-[#db74cf]" />
              )}
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2">
            <AlertCircle
              size={16}
              className="text-red-500 flex-shrink-0 mt-0.5"
            />
            <p className="text-sm text-red-200">{error}</p>
          </div>
        )}

        {/* Install wallet link */}
        <div className="mt-6 text-center">
          <a
            href="https://www.argent.xyz/argent-x/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-[#db74cf] hover:text-[#db74cf]/80 transition-colors"
          >
            Install Argent X <ExternalLink size={14} />
          </a>
        </div>

        {/* Powered by section */}
        <div className="mt-8 pt-4 border-t border-white/10 flex justify-center">
          <div className="text-xs text-white/40 flex items-center gap-2">
            Powered by
            <span className="font-['Orbitron'] text-white/60">StarkPulse</span>
          </div>
        </div>
      </div>
    </div>
  );

  // Use createPortal to render the modal at the document body level
  return createPortal(modalContent, document.body);
}
