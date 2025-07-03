/**
 * API Version Handler Tests
 * Tests for API versioning middleware and routing
 */

const request = require('supertest');
const express = require('express');
const { versionHandler, isDeprecated, isActive, getLatestVersion, API_VERSIONS } = require('../../src/middleware/versionHandler');

describe('API Version Handler', () => {
  // Mock Express app for testing
  let app;
  
  beforeEach(() => {
    app = express();
    app.use(versionHandler);
    
    // Test route that echoes the API version
    app.get('/test', (req, res) => {
      res.json({ version: req.apiVersion });
    });
    
    // Test routes with version in path
    app.get('/v1/test', (req, res) => {
      res.json({ version: req.apiVersion });
    });
    
    app.get('/v2/test', (req, res) => {
      res.json({ version: req.apiVersion });
    });
  });
  
  describe('Version detection', () => {
    test('should detect version from URL path', async () => {
      const response = await request(app).get('/v1/test');
      expect(response.statusCode).toBe(200);
      expect(response.body.version).toBe('v1');
    });
    
    test('should use default version when no version in URL', async () => {
      const response = await request(app).get('/test');
      expect(response.statusCode).toBe(200);
      expect(response.body.version).toBe('v1');
    });
    
    test('should handle invalid version in URL', async () => {
      const response = await request(app).get('/v99/test');
      expect(response.statusCode).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('Deprecation handling', () => {
    test('should add deprecation headers for deprecated versions', async () => {
      // Temporarily mark v1 as deprecated for this test
      const originalV1State = { ...API_VERSIONS.v1 };
      API_VERSIONS.v1.deprecated = true;
      API_VERSIONS.v1.sunset = '2025-12-31';
      
      const response = await request(app).get('/v1/test');
      
      expect(response.statusCode).toBe(200);
      expect(response.headers.deprecation).toBe('true');
      expect(response.headers.warning).toContain('Deprecated API version v1');
      
      // Restore original state
      API_VERSIONS.v1 = originalV1State;
    });
    
    test('should not add deprecation headers for current versions', async () => {
      const response = await request(app).get('/v2/test');
      
      expect(response.statusCode).toBe(200);
      expect(response.headers.deprecation).toBeUndefined();
    });
  });
  
  describe('Version utilities', () => {
    test('isDeprecated should correctly identify deprecated versions', () => {
      // Temporarily mark v1 as deprecated for this test
      const originalV1State = { ...API_VERSIONS.v1 };
      API_VERSIONS.v1.deprecated = true;
      
      expect(isDeprecated('v1')).toBe(true);
      expect(isDeprecated('v2')).toBe(false);
      expect(isDeprecated('v99')).toBe(true); // Non-existent versions are considered deprecated
      
      // Restore original state
      API_VERSIONS.v1 = originalV1State;
    });
    
    test('isActive should correctly identify active versions', () => {
      expect(isActive('v1')).toBe(true);
      expect(isActive('v2')).toBe(true);
      expect(isActive('v99')).toBe(false); // Non-existent versions are not active
    });
    
    test('getLatestVersion should return the current latest version', () => {
      expect(getLatestVersion()).toBe('v2');
    });
  });
  
  describe('Inactive version handling', () => {
    test('should return 410 Gone for inactive versions', async () => {
      // Temporarily mark v1 as inactive for this test
      const originalV1State = { ...API_VERSIONS.v1 };
      API_VERSIONS.v1.active = false;
      
      const response = await request(app).get('/v1/test');
      
      expect(response.statusCode).toBe(410); // Gone
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('no longer available');
      
      // Restore original state
      API_VERSIONS.v1 = originalV1State;
    });
  });
});
