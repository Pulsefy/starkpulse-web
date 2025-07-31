import type { L2State } from "../types/starknet"

export class StateManagerService {
  private l2StateCache: Map<string, L2State> = new Map() // In-memory cache for L2 state

  constructor() {
    console.log("L2 State Manager Service initialized.")
  }

  async getL2State(contractAddress: string): Promise<L2State> {
    if (this.l2StateCache.has(contractAddress)) {
      console.log(`L2 State for ${contractAddress} found in cache.`)
      return this.l2StateCache.get(contractAddress)!
    }

    console.log(`Fetching L2 State for ${contractAddress} from StarkNet (mock).`)
    // In a real scenario, this would query the StarkNet RPC for the contract's state
    await new Promise((resolve) => setTimeout(resolve, 500)) // Simulate network delay

    const mockState: L2State = {
      contractAddress,
      data: {
        value: Math.floor(Math.random() * 10000),
        lastUpdatedBy: `0xUser${Math.floor(Math.random() * 1000)}`,
      },
      lastUpdated: new Date(),
      blockNumber: Math.floor(Math.random() * 100000),
    }
    this.l2StateCache.set(contractAddress, mockState)
    return mockState
  }

  async updateL2State(contractAddress: string, newData: Record<string, any>): Promise<L2State> {
    console.log(`Updating L2 State for ${contractAddress} (mock).`)
    // In a real scenario, this would be triggered by a successful transaction on StarkNet
    const currentState = this.l2StateCache.get(contractAddress) || {
      contractAddress,
      data: {},
      lastUpdated: new Date(),
      blockNumber: 0,
    }

    const updatedState: L2State = {
      ...currentState,
      data: { ...currentState.data, ...newData },
      lastUpdated: new Date(),
      blockNumber: currentState.blockNumber + 1, // Simulate block progression
    }
    this.l2StateCache.set(contractAddress, updatedState)
    console.log(`L2 State for ${contractAddress} updated.`)
    return updatedState
  }

  // Clear cache for a specific contract or all
  clearCache(contractAddress?: string): void {
    if (contractAddress) {
      this.l2StateCache.delete(contractAddress)
      console.log(`Cache cleared for ${contractAddress}.`)
    } else {
      this.l2StateCache.clear()
      console.log("All L2 state cache cleared.")
    }
  }
}
