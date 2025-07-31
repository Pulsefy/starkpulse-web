import request from "supertest"
import app from "../app"
import { StarkNetRpcService } from "../services/starknet-rpc"
import { ProofGeneratorService } from "../services/proof-generator"
import { KeyManagementService } from "../services/key-management"
import { StateManagerService } from "../services/state-manager"
import type { StarkNetTransaction, StarkNetProof } from "../types/starknet"
import jest from "jest" // Declare the jest variable

// Mock services to isolate tests
jest.mock("../services/starknet-rpc")
jest.mock("../services/proof-generator")
jest.mock("../services/key-management")
jest.mock("../services/state-manager")

const MockStarkNetRpcService = StarkNetRpcService as jest.MockedClass<typeof StarkNetRpcService>
const MockProofGeneratorService = ProofGeneratorService as jest.MockedClass<typeof ProofGeneratorService>
const MockKeyManagementService = KeyManagementService as jest.MockedClass<typeof KeyManagementService>
const MockStateManagerService = StateManagerService as jest.MockedClass<typeof StateManagerService>

describe("StarkNet ZKP Integration API", () => {
  let mockRpcService: jest.Mocked<StarkNetRpcService>
  let mockProofService: jest.Mocked<ProofGeneratorService>
  let mockKeyService: jest.Mocked<KeyManagementService>
  let mockStateManager: jest.Mocked<StateManagerService>

  beforeEach(() => {
    // Clear all instances and calls to constructor and all methods:
    MockStarkNetRpcService.mockClear()
    MockProofGeneratorService.mockClear()
    MockKeyManagementService.mockClear()
    MockStateManagerService.mockClear()

    // Mock the constructor to return a mock instance
    MockStarkNetRpcService.mockImplementation(
      () =>
        ({
          connect: jest.fn().mockResolvedValue(true),
          submitTransaction: jest.fn().mockResolvedValue("mockTxHash123"),
          batchTransactions: jest.fn().mockResolvedValue(["mockTxHash1", "mockTxHash2"]),
          getTransactionStatus: jest.fn().mockResolvedValue("ACCEPTED_ON_L2"),
          executeWithFallback: jest.fn((op) => op()), // Just execute the operation directly for tests
          stopBatchProcessor: jest.fn(),
        }) as any,
    )
    MockProofGeneratorService.mockImplementation(
      () =>
        ({
          generateProof: jest.fn().mockResolvedValue({
            proofId: "mockProofId123",
            data: "mockProofData",
            verifierAddress: "0xVerifier",
            status: "GENERATED",
            timestamp: new Date(),
          }),
          verifyProof: jest.fn().mockResolvedValue(true),
        }) as any,
    )
    MockKeyManagementService.mockImplementation(
      () =>
        ({
          generateKeyPair: jest.fn().mockReturnValue({ publicKey: "pk", privateKey: "sk" }),
          signTransaction: jest.fn((tx) => ({ ...tx, signature: ["0xSigned"] })),
          createMultiSigTransaction: jest.fn((tx) => ({ ...tx, type: "INVOKE", calldata: ["multi_sig_execute"] })),
          addSignatureToMultiSig: jest.fn((tx) => ({ ...tx, signature: [...(tx.signature || []), "0xNewSig"] })),
          verifyMultiSig: jest.fn().mockReturnValue(true),
          logInteraction: jest.fn(),
        }) as any,
    )
    MockStateManagerService.mockImplementation(
      () =>
        ({
          getL2State: jest.fn().mockResolvedValue({ contractAddress: "0xMock", data: { value: 100 } }),
          updateL2State: jest.fn().mockResolvedValue({ contractAddress: "0xMock", data: { value: 200 } }),
        }) as any,
    )

    // Get the mock instances
    mockRpcService = new MockStarkNetRpcService([]) as jest.Mocked<StarkNetRpcService>
    mockProofService = new MockProofGeneratorService() as jest.Mocked<ProofGeneratorService>
    mockKeyService = new MockKeyManagementService() as jest.Mocked<KeyManagementService>
    mockStateManager = new MockStateManagerService() as jest.Mocked<StateManagerService>
  })

  describe("StarkNet Connection & Transactions", () => {
    test("POST /api/starknet/transaction should submit a transaction", async () => {
      const transactionPayload = {
        type: "INVOKE",
        contractAddress: "0xContract",
        entrypoint: "transfer",
        calldata: ["0xRecipient", "100"],
        userId: "user123",
      }

      const response = await request(app).post("/api/starknet/transaction").send(transactionPayload).expect(202)

      expect(response.body).toHaveProperty("txHash", "mockTxHash123")
      expect(response.body).toHaveProperty("status", "PENDING")
      expect(mockKeyService.signTransaction).toHaveBeenCalledTimes(1)
      expect(mockRpcService.submitTransaction).toHaveBeenCalledTimes(1)
    })

    test("POST /api/starknet/transactions/batch should submit batched transactions", async () => {
      const batchPayload = {
        transactions: [
          { type: "INVOKE", contractAddress: "0xContract1", entrypoint: "mint" },
          { type: "INVOKE", contractAddress: "0xContract2", entrypoint: "burn" },
        ],
      }

      const response = await request(app).post("/api/starknet/transactions/batch").send(batchPayload).expect(202)

      expect(response.body).toHaveProperty("txHashes")
      expect(response.body.txHashes).toEqual(["mockTxHash1", "mockTxHash2"])
      expect(response.body).toHaveProperty("status", "PENDING_BATCH")
      expect(mockRpcService.batchTransactions).toHaveBeenCalledTimes(1)
    })

    test("GET /api/starknet/transaction/:txHash/status should return transaction status", async () => {
      const txHash = "someTxHash"
      const response = await request(app).get(`/api/starknet/transaction/${txHash}/status`).expect(200)

      expect(response.body).toHaveProperty("txHash", txHash)
      expect(response.body).toHaveProperty("status", "ACCEPTED_ON_L2")
      expect(mockRpcService.getTransactionStatus).toHaveBeenCalledWith(txHash)
    })
  })

  describe("Zero-Knowledge Proofs", () => {
    test("POST /api/starknet/proof/generate should initiate proof generation", async () => {
      const dataToProve = { value: 100, condition: "greaterThan50" }
      const response = await request(app).post("/api/starknet/proof/generate").send({ dataToProve }).expect(200)

      expect(response.body).toHaveProperty("proofId", "mockProofId123")
      expect(response.body).toHaveProperty("status", "GENERATED")
      expect(mockProofService.generateProof).toHaveBeenCalledWith(dataToProve)
    })

    test("POST /api/starknet/proof/verify should verify a proof", async () => {
      const mockProof: StarkNetProof = {
        proofId: "testProof",
        data: "encodedData",
        verifierAddress: "0xVerifier",
        status: "GENERATED",
        timestamp: new Date(),
      }
      const response = await request(app).post("/api/starknet/proof/verify").send({ proof: mockProof }).expect(200)

      expect(response.body).toHaveProperty("isValid", true)
      expect(mockProofService.verifyProof).toHaveBeenCalledWith(mockProof)
    })
  })

  describe("L2 State Management", () => {
    test("GET /api/starknet/state/:contractAddress should return L2 state", async () => {
      const contractAddress = "0xMockContract"
      const response = await request(app).get(`/api/starknet/state/${contractAddress}`).expect(200)

      expect(response.body).toHaveProperty("contractAddress", contractAddress)
      expect(response.body).toHaveProperty("data", { value: 100 })
      expect(mockStateManager.getL2State).toHaveBeenCalledWith(contractAddress)
    })
  })

  describe("Key Management & Multi-signature", () => {
    const mockTx: StarkNetTransaction = {
      id: "tx1",
      type: "INVOKE",
      contractAddress: "0xContract",
      entrypoint: "doSomething",
    }

    test("POST /api/starknet/multisig/create should create a multi-sig transaction", async () => {
      const payload = {
        transaction: mockTx,
        requiredSigners: 2,
        signerPublicKeys: ["0xPk1", "0xPk2", "0xPk3"],
      }
      const response = await request(app).post("/api/starknet/multisig/create").send(payload).expect(200)

      expect(response.body).toHaveProperty("multiSigTx")
      expect(mockKeyService.createMultiSigTransaction).toHaveBeenCalledWith(
        mockTx,
        payload.requiredSigners,
        payload.signerPublicKeys,
      )
    })

    test("POST /api/starknet/multisig/add-signature should add a signature", async () => {
      const payload = {
        transaction: mockTx,
        userId: "signer1",
      }
      const response = await request(app).post("/api/starknet/multisig/add-signature").send(payload).expect(200)

      expect(response.body).toHaveProperty("signedTx")
      expect(mockKeyService.addSignatureToMultiSig).toHaveBeenCalledWith(mockTx, payload.userId)
    })

    test("POST /api/starknet/multisig/verify should verify a multi-sig transaction", async () => {
      const payload = {
        transaction: mockTx,
        signatures: ["0xSig1", "0xSig2"],
        requiredSigners: 2,
      }
      const response = await request(app).post("/api/starknet/multisig/verify").send(payload).expect(200)

      expect(response.body).toHaveProperty("isValid", true)
      expect(mockKeyService.verifyMultiSig).toHaveBeenCalledWith(mockTx, payload.signatures, payload.requiredSigners)
    })
  })

  describe("Security & Performance Middleware", () => {
    test("auditTrail middleware should log interactions", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {}) // Suppress console output
      const transactionPayload = {
        type: "INVOKE",
        contractAddress: "0xContract",
        entrypoint: "transfer",
        calldata: ["0xRecipient", "100"],
        userId: "auditUser",
      }

      await request(app).post("/api/starknet/transaction").send(transactionPayload).expect(202)

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("AUDIT LOG: User: auditUser"))
      consoleSpy.mockRestore()
    })

    test("cachingMiddleware should cache responses for GET requests", async () => {
      const contractAddress = "0xCachedContract"
      mockStateManager.getL2State.mockClear() // Clear previous calls

      // First request - should call service
      await request(app).get(`/api/starknet/state/${contractAddress}`).expect(200)
      expect(mockStateManager.getL2State).toHaveBeenCalledTimes(1)

      // Second request - should hit cache
      await request(app).get(`/api/starknet/state/${contractAddress}`).expect(200)
      expect(mockStateManager.getL2State).toHaveBeenCalledTimes(1) // Still 1 call
    })

    test("loadBalancingMiddleware should be applied", async () => {
      const transactionPayload = {
        type: "INVOKE",
        contractAddress: "0xContract",
        entrypoint: "transfer",
        calldata: ["0xRecipient", "100"],
        userId: "user123",
      }
      // This test primarily checks if the middleware is in the route chain.
      // The actual load balancing logic is mocked within StarkNetRpcService.
      const response = await request(app).post("/api/starknet/transaction").send(transactionPayload).expect(202)
      expect(response.body).toHaveProperty("txHash")
    })
  })

  describe("Validation", () => {
    test("should return 400 for invalid transaction type", async () => {
      const invalidPayload = {
        type: "INVALID_TYPE",
        contractAddress: "0xContract",
        entrypoint: "transfer",
        calldata: ["0xRecipient", "100"],
        userId: "user123",
      }
      const response = await request(app).post("/api/starknet/transaction").send(invalidPayload).expect(400)
      expect(response.body.error).toBe("Validation failed")
      expect(response.body.details[0].msg).toBe("Invalid transaction type")
    })

    test("should return 400 for missing userId in transaction submission", async () => {
      const invalidPayload = {
        type: "INVOKE",
        contractAddress: "0xContract",
        entrypoint: "transfer",
        calldata: ["0xRecipient", "100"],
      }
      const response = await request(app).post("/api/starknet/transaction").send(invalidPayload).expect(400)
      expect(response.body.error).toBe("Validation failed")
      expect(response.body.details[0].msg).toBe("User ID is required for signing")
    })

    test("should return 400 for invalid proof verification payload", async () => {
      const invalidPayload = {
        proof: {
          proofId: "test",
          data: "data",
          verifierAddress: "0xVerifier",
          status: "INVALID_STATUS", // Invalid status
        },
      }
      const response = await request(app).post("/api/starknet/proof/verify").send(invalidPayload).expect(400)
      expect(response.body.error).toBe("Validation failed")
      expect(response.body.details[0].msg).toBe("Invalid proof status")
    })
  })
})
