"use client";

import { useAccount, useConnect, useDisconnect } from "@starknet-react/core";
import { useState, useEffect } from "react";

export function useWallet() {
  const { address, isConnected, isReconnecting, status } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // In your connectWallet function
  const connectWallet = async () => {
    setIsLoading(true);
    setError(null);

    // Look for both possible IDs that Argent X might use
    const connector = connectors.find(
      (c: any) =>
        c.id === "argentX" ||
        c.id === "argent" ||
        c.name?.toLowerCase().includes("argent")
    );

    if (connector) {
      try {
        await connect({ connector });
        setIsLoading(false);
      } catch (error: any) {
        console.error("Failed to connect:", error);
        setError(error.message || "Failed to connect to wallet");
        setIsLoading(false);
        // Open modal if direct connection fails
        setIsModalOpen(true);
      }
    } else {
      // No connector found, open modal
      setIsLoading(false);
      setIsModalOpen(true);
    }
  };

  const disconnectWallet = async () => {
    try {
      await disconnect();
    } catch (error) {
      console.error("Failed to disconnect:", error);
    }
  };

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  // Format address for display
  const shortenedAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : "";

  return {
    address,
    shortenedAddress,
    isConnected,
    isReconnecting,
    isLoading,
    error,
    status,
    connectWallet,
    disconnectWallet,
    isModalOpen,
    openModal,
    closeModal,
  };
}