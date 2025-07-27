import type { Request, Response, NextFunction } from "express"
import type { AuditLogEntry } from "../types/starknet"

// Mock Audit Log Storage
const auditLogs: AuditLogEntry[] = []

export function auditTrail(req: Request, res: Response, next: NextFunction): void {
  const startTime = process.hrtime.bigint()

  res.on("finish", () => {
    const endTime = process.hrtime.bigint()
    const durationMs = Number(endTime - startTime) / 1_000_000

    const userId = (req.body.userId || req.headers["x-user-id"] || "anonymous") as string
    const action = `${req.method} ${req.originalUrl}`
    const status = res.statusCode >= 200 && res.statusCode < 400 ? "SUCCESS" : "FAILURE"

    const logEntry: AuditLogEntry = {
      timestamp: new Date(),
      userId,
      action,
      details: {
        ip: req.ip,
        statusCode: res.statusCode,
        durationMs,
        body: req.body, // Be careful with sensitive data here in a real app
        params: req.params,
        query: req.query,
      },
      status,
    }

    auditLogs.push(logEntry)
    console.log(
      `AUDIT LOG: ${logEntry.timestamp.toISOString()} | User: ${userId} | Action: ${action} | Status: ${status} | Duration: ${durationMs.toFixed(2)}ms`,
    )
    // In a real system, this would be sent to a dedicated, immutable audit log service
  })

  next()
}

// Example function to retrieve audit logs (for internal use/monitoring)
export function getAuditLogs(): AuditLogEntry[] {
  return auditLogs
}
