"use client";

import { ReactNode } from "react";
import { mainnet } from "@starknet-react/chains";
import {
  StarknetConfig,
  argent,
  useInjectedConnectors,
  voyager,
  jsonRpcProvider,
} from "@starknet-react/core";

interface StarknetProviderProps {
  children: ReactNode;
}

export function StarknetProvider({ children }: StarknetProviderProps) {
  // Use the argent connector without arguments
  const { connectors } = useInjectedConnectors({
    // Show these connectors if the user has no connector installed.
    recommended: [argent()],
    // Hide recommended connectors if the user has any connector installed.
    includeRecommended: "onlyIfNoConnectors",
  });

  return (
    <StarknetConfig
      chains={[mainnet]}
      provider={jsonRpcProvider({
        rpc: () => ({
          nodeUrl: "https://starknet-mainnet.public.blastapi.io",
        }),
      })}
      connectors={connectors}
      explorer={voyager}
      autoConnect
    >
      {children}
    </StarknetConfig>
  );
}
