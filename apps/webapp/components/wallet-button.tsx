'use client';

import { useState, useEffect, useMemo } from 'react';
import { Wallet, LogOut } from 'lucide-react';
import { useConnect, useAccount, useDisconnect, Connector } from '@starknet-react/core';

interface WalletButtonProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function WalletButton({
  className = '',
  size = 'md',
}: WalletButtonProps) {
  const { connect, connectors } = useConnect();
  const { address, status } = useAccount();
  const { disconnect } = useDisconnect();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const availableConnectors = useMemo(() => {
    if (!isClient) return [];
    return connectors;
  }, [connectors, isClient]);

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg',
  };

  const handleConnect = (connector: Connector) => {
    connect({ connector });
    setIsModalOpen(false);
  };

  const handleDisconnect = () => {
    disconnect();
  };

  const truncateAddress = (addr: string) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (!isClient) {
    return null;
  }

  return (
    <>
      {status === 'connected' ? (
        <div className='flex items-center gap-2'>
          <button
            onClick={() => {}}
            className={`relative group rounded-lg font-medium flex items-center gap-2 transition-all duration-300 ${sizeClasses[size]} ${className}`}
          >
            <span className='absolute inset-0 rounded-lg bg-black/30 backdrop-blur-sm'></span>
            <span className='absolute inset-0 rounded-lg border-2 border-[#db74cf] group-hover:border-opacity-100 border-opacity-70 transition-all'></span>
            <span className='absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-md bg-[#db74cf]/10'></span>
            <span className='relative z-10 flex items-center justify-center gap-2 text-white'>
              <Wallet
                className={`text-primary group-hover:text-white transition-colors ${
                  size === 'sm'
                    ? 'w-3.5 h-3.5'
                    : size === 'lg'
                    ? 'w-5 h-5'
                    : 'w-4 h-4'
                }`}
              />
              {truncateAddress(address)}
            </span>
          </button>
          <button
            onClick={handleDisconnect}
            className='relative group rounded-lg font-medium flex items-center p-2 transition-all duration-300 bg-black/30 backdrop-blur-sm border-2 border-red-500/70 hover:border-red-500'
          >
            <LogOut className='w-4 h-4 text-red-500' />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsModalOpen(true)}
          className={`relative group rounded-lg font-medium flex items-center gap-2 transition-all duration-300 ${sizeClasses[size]} ${className}`}
        >
          <span className='absolute inset-0 rounded-lg bg-black/30 backdrop-blur-sm'></span>
          <span className='absolute inset-0 rounded-lg border-2 border-[#db74cf] group-hover:border-opacity-100 border-opacity-70 transition-all'></span>
          <span className='absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-md bg-[#db74cf]/10'></span>
          <span className='relative z-10 flex items-center justify-center gap-2 text-white'>
            <Wallet
              className={`text-primary group-hover:text-white transition-colors ${
                size === 'sm'
                  ? 'w-3.5 h-3.5'
                  : size === 'lg'
                  ? 'w-5 h-5'
                  : 'w-4 h-4'
              }`}
            />
            Connect Wallet
          </span>
        </button>
      )}

      {isModalOpen && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md'>
          <div className='relative bg-black/50 border-2 border-primary/50 rounded-2xl p-8 max-w-sm w-full shadow-lg'>
            <button
              onClick={() => setIsModalOpen(false)}
              className='absolute top-4 right-4 text-white/70 hover:text-white transition-colors'
            >
              &times;
            </button>
            <h2 className='text-2xl font-bold text-center mb-6 text-white'>
              Connect a Wallet
            </h2>
            <div className='space-y-4'>
              {availableConnectors.map((connector) => (
                <button
                  key={connector.id}
                  onClick={() => handleConnect(connector)}
                  disabled={!connector.available()}
                  className='w-full flex items-center justify-between px-6 py-4 bg-white/5 rounded-lg hover:bg-white/10 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed'
                >
                  <span className='font-medium text-lg text-white'>
                    {connector.name}
                  </span>
                  {!connector.available() && (
                    <span className='text-xs text-white/50'>
                      Not Installed
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
