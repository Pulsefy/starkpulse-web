import type { Request, Response, NextFunction } from "express"

// Simple in-memory cache
const cache = new Map<string, { data: any; expiry: number }>()
const CACHE_DURATION_MS = 60 * 1000 // 1 minute

export function cachingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const key = req.originalUrl
  const cached = cache.get(key)

  if (cached && cached.expiry > Date.now()) {
    console.log(`Cache hit for ${key}`)
    return res.json(cached.data)
  }

  // Override res.json to cache the response
  const originalJson = res.json
  res.json = (body: any): Response => {
    console.log(`Caching response for ${key}`)
    cache.set(key, { data: body, expiry: Date.now() + CACHE_DURATION_MS })
    return originalJson.call(res, body)
  }

  next()
}

// Mock Load Balancing (conceptual)
export function loadBalancingMiddleware(req: Request, res: Response, next: NextFunction): void {
  // In a real scenario, this middleware would interact with a load balancer
  // or a service discovery mechanism to select the optimal StarkNet node.
  // For example, it might add a header indicating which node to use, or
  // directly proxy the request.
  console.log("Applying mock load balancing logic...")
  // const selectedNode = selectOptimalNode(); // Logic to select a node
  // req.headers['X-StarkNet-Node'] = selectedNode.url;
  next()
}

// Fallback Mechanism (conceptual - actual fallback handled in StarkNetRpcService)
export function fallbackMiddleware(err: any, req: Request, res: Response, next: NextFunction): void {
  // This middleware would catch errors from upstream services (e.g., StarkNet RPC)
  // and potentially trigger a retry or return a graceful degradation message.
  // The `StarkNetRpcService` already implements a retry/fallback mechanism for RPC calls.
  console.error("Fallback middleware caught an error:", err.message)
  if (err.message.includes("All StarkNet nodes failed")) {
    res.status(503).json({
      error: "Service Unavailable",
      message: "StarkNet network issues, please try again later.",
    })
  } else {
    next(err) // Pass to the general error handler
  }
}
