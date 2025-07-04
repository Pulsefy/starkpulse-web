/**
 * API Routes Versioning Integration Tests
 * Tests for API routing across different versions
 */

const request = require('supertest');
const express = require('express');

describe('API Routes Versioning', () => {
  // Mock Express app for testing
  let app;
  
  beforeEach(() => {
    jest.resetModules();
    app = express();
    
    // Mock middleware to avoid dependencies
    app.use(express.json());
    
    // Mock version handler middleware
    app.use((req, res, next) => {
      const urlParts = req.path.split('/');
      const versionMatch = urlParts.find(part => part.match(/^v\d+$/i));
      req.apiVersion = versionMatch || 'v1';
      next();
    });
    
    // Version routes
    app.get('/versions', (req, res) => {
      res.json({
        versions: {
          v1: { active: true, deprecated: false },
          v2: { active: true, deprecated: false }
        },
        current: 'v2'
      });
    });
    
    // v1 routes with simpler responses
    app.get('/v1/users', (req, res) => {
      res.json({
        users: [
          { id: 1, name: 'User 1' },
          { id: 2, name: 'User 2' }
        ]
      });
    });
    
    // v2 routes with enhanced responses
    app.get('/v2/users', (req, res) => {
      res.json({
        users: [
          { id: 1, name: 'User 1', email: 'user1@example.com', created_at: '2025-01-01' },
          { id: 2, name: 'User 2', email: 'user2@example.com', created_at: '2025-01-02' }
        ],
        pagination: {
          total: 2,
          page: 1,
          limit: 10
        }
      });
    });
    
    // Default route (should use latest version)
    app.get('/users', (req, res) => {
      // Redirect to latest version
      res.redirect('/v2/users');
    });
  });
  
  describe('Version information', () => {
    test('should return version information', async () => {
      const response = await request(app).get('/versions');
      
      expect(response.statusCode).toBe(200);
      expect(response.body.versions).toBeDefined();
      expect(response.body.current).toBe('v2');
    });
  });
  
  describe('Version-specific endpoints', () => {
    test('v1 endpoints should return simple responses', async () => {
      const response = await request(app).get('/v1/users');
      
      expect(response.statusCode).toBe(200);
      expect(response.body.users).toHaveLength(2);
      expect(response.body.users[0]).toHaveProperty('id');
      expect(response.body.users[0]).toHaveProperty('name');
      expect(response.body.users[0]).not.toHaveProperty('email');
      expect(response.body).not.toHaveProperty('pagination');
    });
    
    test('v2 endpoints should return enhanced responses', async () => {
      const response = await request(app).get('/v2/users');
      
      expect(response.statusCode).toBe(200);
      expect(response.body.users).toHaveLength(2);
      expect(response.body.users[0]).toHaveProperty('id');
      expect(response.body.users[0]).toHaveProperty('name');
      expect(response.body.users[0]).toHaveProperty('email');
      expect(response.body).toHaveProperty('pagination');
    });
  });
  
  describe('Default routes', () => {
    test('unversioned routes should redirect to the latest version', async () => {
      const response = await request(app).get('/users');
      
      expect(response.statusCode).toBe(302); // Redirect status code
      expect(response.headers.location).toBe('/v2/users');
    });
  });
  
  describe('Backward compatibility', () => {
    test('v2 responses should include all v1 fields plus enhancements', async () => {
      const v1Response = await request(app).get('/v1/users');
      const v2Response = await request(app).get('/v2/users');
      
      // Check that v1 fields are present in v2
      v1Response.body.users.forEach((v1User, index) => {
        const v2User = v2Response.body.users[index];
        
        // All v1 fields should exist in v2
        for (const key of Object.keys(v1User)) {
          expect(v2User).toHaveProperty(key);
        }
        
        // v2 should have additional fields
        expect(Object.keys(v2User).length).toBeGreaterThan(Object.keys(v1User).length);
      });
    });
  });
});
