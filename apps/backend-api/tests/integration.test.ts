import request from "supertest"
import app from "../app"

describe("Analytics API Integration Tests", () => {
  const portfolioId = "test-portfolio-123"

  describe("GET /api/analytics/portfolio/:portfolioId", () => {
    test("should return portfolio analytics", async () => {
      const response = await request(app).get(`/api/analytics/portfolio/${portfolioId}`).expect(200)

      expect(response.body).toHaveProperty("portfolio")
      expect(response.body).toHaveProperty("performance")
      expect(response.body).toHaveProperty("risk")
      expect(response.body).toHaveProperty("allocation")
      expect(response.body.performance).toHaveProperty("roi")
      expect(response.body.performance).toHaveProperty("sharpeRatio")
    })

    test("should handle invalid portfolio ID", async () => {
      await request(app).get("/api/analytics/portfolio/invalid-id").expect(400)
    })
  })

  describe("POST /api/analytics/portfolio/:portfolioId/rebalancing", () => {
    test("should return rebalancing recommendations", async () => {
      const targetAllocations = {
        AAPL: 0.3,
        GOOGL: 0.3,
        MSFT: 0.4,
      }

      const response = await request(app)
        .post(`/api/analytics/portfolio/${portfolioId}/rebalancing`)
        .send({ targetAllocations })
        .expect(200)

      expect(response.body).toHaveProperty("recommendations")
      expect(response.body.recommendations).toBeInstanceOf(Array)
    })
  })

  describe("POST /api/analytics/portfolio/:portfolioId/stress-test", () => {
    test("should perform stress test", async () => {
      const scenarios = [
        {
          name: "Market Crash",
          description: "Test scenario",
          shocks: { AAPL: -30, GOOGL: -25 },
          expectedPortfolioImpact: -27.5,
        },
      ]

      const response = await request(app)
        .post(`/api/analytics/portfolio/${portfolioId}/stress-test`)
        .send({ scenarios })
        .expect(200)

      expect(response.body).toHaveProperty("results")
      expect(response.body.results).toHaveProperty("scenarios")
    })
  })

  describe("Rate Limiting", () => {
    test("should enforce rate limits", async () => {
      // Make multiple requests quickly
      const requests = Array(101)
        .fill(null)
        .map(() => request(app).get(`/api/analytics/portfolio/${portfolioId}`))

      const responses = await Promise.allSettled(requests)
      const rateLimitedResponses = responses.filter(
        (result) => result.status === "fulfilled" && result.value.status === 429,
      )

      expect(rateLimitedResponses.length).toBeGreaterThan(0)
    })
  })
})
