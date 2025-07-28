import type { Request, Response } from "express"
import { StarkNetRpcService } from "../services/starknet-rpc"
import { ProofGeneratorService } from "../services/proof-generator"
import { KeyManagementService } from "../services/key-management"
import { StateManagerService } from "../services/state-manager"
import type { StarkNetTransaction, StarkNetProof } from "../types/starknet"
import { v4 as uuidv4 } from "uuid"

export class StarkNetController {
  private rpcService: StarkNetRpcService
  private proofService: ProofGeneratorService
  private keyService: KeyManagementService
  private stateService: StateManagerService

  constructor() {
    // In a real app, node URLs would come from config/env
    this.rpcService = new StarkNetRpcService([
      "https://alpha-mainnet.starknet.io/rpc",
      "https://alpha4.starknet.io/rpc",
    ])
    this.proofService = new ProofGeneratorService()
    this.keyService = new KeyManagementService()
    this.stateService = new StateManagerService()

    // Connect RPC on startup
    this.rpcService.connect().catch(console.error)
  }

  async submitTransaction(req: Request, res: Response): Promise<void> {
    try {
      const { type, contractAddress, entrypoint, calldata, userId } = req.body
      const transaction: StarkNetTransaction = {
        id: uuidv4(),
        type,
        contractAddress,
        entrypoint,
        calldata,
        timestamp: new Date(),
      }

      // Simulate signing
      const signedTx = this.keyService.signTransaction(transaction, userId || "mock_user")

      const txHash = await this.rpcService.executeWithFallback(() => this.rpcService.submitTransaction(signedTx))

      res.status(202).json({
        message: "Transaction submitted successfully",
        txHash,
        status: "PENDING",
      })
    } catch (error: any) {
      console.error("Error submitting transaction:", error)
      res.status(500).json({ error: "Failed to submit transaction", details: error.message })
    }
  }

  async submitBatchedTransactions(req: Request, res: Response): Promise<void> {
    try {
      const transactions: StarkNetTransaction[] = req.body.transactions.map((tx: any) => ({
        id: uuidv4(),
        timestamp: new Date(),
        ...tx,
      }))

      // In a real scenario, each transaction would be signed by its respective user
      // For this mock, we'll assume they are pre-signed or signed by a central entity.
      const txHashes = await this.rpcService.executeWithFallback(() => this.rpcService.batchTransactions(transactions))

      res.status(202).json({
        message: "Transactions submitted in batch successfully",
        txHashes,
        status: "PENDING_BATCH",
      })
    } catch (error: any) {
      console.error("Error submitting batched transactions:", error)
      res.status(500).json({ error: "Failed to submit batched transactions", details: error.message })
    }
  }

  async getTransactionStatus(req: Request, res: Response): Promise<void> {
    try {
      const { txHash } = req.params
      const status = await this.rpcService.executeWithFallback(() => this.rpcService.getTransactionStatus(txHash))
      res.json({ txHash, status })
    } catch (error: any) {
      console.error("Error getting transaction status:", error)
      res.status(500).json({ error: "Failed to get transaction status", details: error.message })
    }
  }

  async generateProof(req: Request, res: Response): Promise<void> {
    try {
      const { dataToProve } = req.body
      const proof = await this.proofService.generateProof(dataToProve)
      res.status(200).json({
        message: "Proof generation initiated",
        proofId: proof.proofId,
        status: proof.status,
      })
    } catch (error: any) {
      console.error("Error generating proof:", error)
      res.status(500).json({ error: "Failed to generate proof", details: error.message })
    }
  }

  async verifyProof(req: Request, res: Response): Promise<void> {
    try {
      const proof: StarkNetProof = req.body.proof
      const isValid = await this.proofService.verifyProof(proof)
      res.status(200).json({
        message: isValid ? "Proof verified successfully" : "Proof verification failed",
        proofId: proof.proofId,
        isValid,
      })
    } catch (error: any) {
      console.error("Error verifying proof:", error)
      res.status(500).json({ error: "Failed to verify proof", details: error.message })
    }
  }

  async getL2State(req: Request, res: Response): Promise<void> {
    try {
      const { contractAddress } = req.params
      const state = await this.stateService.getL2State(contractAddress)
      res.json(state)
    } catch (error: any) {
      console.error("Error getting L2 state:", error)
      res.status(500).json({ error: "Failed to get L2 state", details: error.message })
    }
  }

  async createMultiSigTransaction(req: Request, res: Response): Promise<void> {
    try {
      const { transaction, requiredSigners, signerPublicKeys } = req.body
      const multiSigTx = this.keyService.createMultiSigTransaction(transaction, requiredSigners, signerPublicKeys)
      res.status(200).json({
        message: "Multi-signature transaction created",
        multiSigTx,
      })
    } catch (error: any) {
      console.error("Error creating multi-sig transaction:", error)
      res.status(500).json({ error: "Failed to create multi-sig transaction", details: error.message })
    }
  }

  async addSignatureToMultiSig(req: Request, res: Response): Promise<void> {
    try {
      const { transaction, userId } = req.body
      const signedTx = this.keyService.addSignatureToMultiSig(transaction, userId)
      res.status(200).json({
        message: "Signature added to multi-signature transaction",
        signedTx,
      })
    } catch (error: any) {
      console.error("Error adding signature to multi-sig transaction:", error)
      res.status(500).json({ error: "Failed to add signature", details: error.message })
    }
  }

  async verifyMultiSigTransaction(req: Request, res: Response): Promise<void> {
    try {
      const { transaction, signatures, requiredSigners } = req.body
      const isValid = this.keyService.verifyMultiSig(transaction, signatures, requiredSigners)
      res.status(200).json({
        message: isValid ? "Multi-signature transaction verified" : "Multi-signature verification failed",
        isValid,
      })
    } catch (error: any) {
      console.error("Error verifying multi-sig transaction:", error)
      res.status(500).json({ error: "Failed to verify multi-sig transaction", details: error.message })
    }
  }
}
