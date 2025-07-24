// Performance and Acceptance Criteria Tests for Market Intelligence API
const request = require('supertest');
const express = require('express');
const marketIntelRoutes = require('../src/routes/market-intel');

const app = express();
app.use('/api/market-intel', marketIntelRoutes);

const SLA_MS = 2000;

describe('Market Intelligence API Acceptance Criteria', () => {
  describe('Data Accuracy', () => {
    it('should return real market data matching Binance structure', async () => {
      const res = await request(app).get('/api/market-intel/market-data?symbol=BTCUSDT');
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('source', 'binance');
      expect(res.body).toHaveProperty('symbol', 'BTCUSDT');
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('symbol', 'BTCUSDT');
      expect(res.body.data).toHaveProperty('lastPrice');
      expect(res.body.data).toHaveProperty('volume');
    });
  });

  describe('Sentiment Analysis', () => {
    it('should return consistent sentiment analysis results', async () => {
      const res = await request(app).get('/api/market-intel/sentiment/news');
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('source', 'cryptopanic');
      expect(res.body).toHaveProperty('sentiment');
      expect(Array.isArray(res.body.sentiment)).toBe(true);
      if (res.body.sentiment.length > 0) {
        expect(res.body.sentiment[0]).toHaveProperty('headline');
        expect(res.body.sentiment[0]).toHaveProperty('sentiment');
        expect(typeof res.body.sentiment[0].sentiment).toBe('number');
      }
    });
  });

  describe('Predictions', () => {
    it('should return a numeric price prediction', async () => {
      const res = await request(app).get('/api/market-intel/predictive/price?symbol=BTCUSDT');
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('symbol', 'BTCUSDT');
      expect(res.body).toHaveProperty('prediction');
      expect(typeof res.body.prediction).toBe('number');
    });
  });

  describe('Performance (SLA)', () => {
    it('should respond within SLA for /market-data', async () => {
      const start = Date.now();
      const res = await request(app).get('/api/market-intel/market-data?symbol=BTCUSDT');
      const duration = Date.now() - start;
      expect(res.statusCode).toBe(200);
      expect(duration).toBeLessThanOrEqual(SLA_MS);
    });

    it('should respond within SLA for /sentiment/news', async () => {
      const start = Date.now();
      const res = await request(app).get('/api/market-intel/sentiment/news');
      const duration = Date.now() - start;
      expect(res.statusCode).toBe(200);
      expect(duration).toBeLessThanOrEqual(SLA_MS);
    });

    it('should respond within SLA for /predictive/price', async () => {
      const start = Date.now();
      const res = await request(app).get('/api/market-intel/predictive/price?symbol=BTCUSDT');
      const duration = Date.now() - start;
      expect(res.statusCode).toBe(200);
      expect(duration).toBeLessThanOrEqual(SLA_MS);
    });
  });
});
