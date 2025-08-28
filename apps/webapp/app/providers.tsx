"use client"

import { ReactNode } from "react";
import { mainnet } from "@starknet-react/chains";
import {
  StarknetConfig,
  publicProvider,
  braavos,
  useInjectedConnectors,
  ready,
} from "@starknet-react/core";

export function StarknetProvider({ children }: { children: ReactNode }) {
  const { connectors } = useInjectedConnectors({
    // Show these connectors if the user has no connector installed.
    recommended: [ready(), braavos()],
    // Hide recommended connectors if the user has any connector installed.
    includeRecommended: "always",
    // Randomize the order of the connectors.
    order: "random",
  });

  return (
    <StarknetConfig
      chains={[mainnet]}
      provider={publicProvider()}
      connectors={connectors}
    >
      {children}
    </StarknetConfig>
  );
}
