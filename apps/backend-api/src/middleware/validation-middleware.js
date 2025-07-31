import type { Request, Response, NextFunction } from "express"
import { body, param, validationResult } from "express-validator"

function handleValidationErrors(req: Request, res: Response, next: NextFunction): void {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({
      error: "Validation failed",
      details: errors.array(),
    })
    return
  }
  next()
}

export const validateTransactionSubmission = [
  body("type").isIn(["INVOKE", "DEPLOY", "DECLARE", "L1_HANDLER"]).withMessage("Invalid transaction type"),
  body("contractAddress").optional().isString().withMessage("Contract address must be a string"),
  body("entrypoint").optional().isString().withMessage("Entrypoint must be a string"),
  body("calldata").optional().isArray().withMessage("Calldata must be an array of strings"),
  body("userId").isString().withMessage("User ID is required for signing"),
  handleValidationErrors,
]

export const validateBatchSubmission = [
  body("transactions").isArray().withMessage("Transactions must be an array"),
  body("transactions.*.type")
    .isIn(["INVOKE", "DEPLOY", "DECLARE", "L1_HANDLER"])
    .withMessage("Invalid transaction type in batch"),
  body("transactions.*.contractAddress").optional().isString().withMessage("Contract address must be a string"),
  body("transactions.*.entrypoint").optional().isString().withMessage("Entrypoint must be a string"),
  body("transactions.*.calldata").optional().isArray().withMessage("Calldata must be an array of strings"),
  handleValidationErrors,
]

export const validateProofGeneration = [
  body("dataToProve").isObject().withMessage("Data to prove is required and must be an object"),
  handleValidationErrors,
]

export const validateProofVerification = [
  body("proof").isObject().withMessage("Proof object is required"),
  body("proof.proofId").isString().withMessage("Proof ID is required"),
  body("proof.data").isString().withMessage("Proof data is required"),
  body("proof.verifierAddress").isString().withMessage("Verifier address is required"),
  body("proof.status").isIn(["GENERATED", "VERIFIED", "FAILED"]).withMessage("Invalid proof status"),
  handleValidationErrors,
]

export const validateContractAddress = [
  param("contractAddress").isString().withMessage("Contract address is required"),
  handleValidationErrors,
]

export const validateMultiSigCreation = [
  body("transaction").isObject().withMessage("Transaction object is required"),
  body("requiredSigners").isInt({ min: 1 }).withMessage("Required signers must be a positive integer"),
  body("signerPublicKeys").isArray().withMessage("Signer public keys must be an array of strings"),
  handleValidationErrors,
]

export const validateMultiSigSignature = [
  body("transaction").isObject().withMessage("Transaction object is required"),
  body("userId").isString().withMessage("User ID is required"),
  handleValidationErrors,
]

export const validateMultiSigVerification = [
  body("transaction").isObject().withMessage("Transaction object is required"),
  body("signatures").isArray().withMessage("Signatures must be an array of strings"),
  body("requiredSigners").isInt({ min: 1 }).withMessage("Required signers must be a positive integer"),
  handleValidationErrors,
]
