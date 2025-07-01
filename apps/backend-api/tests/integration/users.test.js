const mongoose = require('mongoose');
const mockData = require('../fixtures/mockData');
const User = require('../../src/models/User');
const bcrypt = require('bcryptjs');

let testUser;
let adminUser;
let accessToken;
let adminAccessToken;

beforeAll(async () => {
  // Make sure we are connected to MongoDB before running tests
  if (mongoose.connection.readyState !== 1) {
    console.log('MongoDB not connected, waiting to reconnect...');
    await mongoose.disconnect();
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB for user integration tests');
  }
  
  // Create test users before running tests
  const salt = bcrypt.genSaltSync(10);
  const hashedPassword = bcrypt.hashSync('Password123!', salt);
  
  testUser = new User({
    username: 'testuser',
    email: 'test@example.com',
    password: hashedPassword,
    firstName: 'Test',  // Adding required field
    lastName: 'User',   // Adding required field
    verified: true,
    role: 'user'
  });
  
  adminUser = new User({
    username: 'adminuser',
    email: 'admin@example.com',
    password: hashedPassword,
    firstName: 'Admin',  // Adding required field
    lastName: 'User',    // Adding required field
    verified: true,
    role: 'admin'
  });
  
  // Clear any existing users with these emails
  await User.deleteMany({
    email: { $in: ['test@example.com', 'admin@example.com'] }
  });
  
  await testUser.save();
  await adminUser.save();
  
  // Create authentication tokens manually to avoid login issues
  const jwt = require('jsonwebtoken');
  const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
  const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-jwt-refresh-secret';
  
  accessToken = jwt.sign({ userId: testUser._id, role: 'user' }, JWT_SECRET, { expiresIn: '1h' });
  adminAccessToken = jwt.sign({ userId: adminUser._id, role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
  
  console.log('Successfully created test tokens for user integration tests');
});

afterAll(async () => {
  // Clean up test data
  if (mongoose.connection.readyState === 1) {
    await User.deleteMany({
      email: { $in: ['test@example.com', 'admin@example.com'] }
    });
  }
});

describe('User API Integration Tests', () => {
  describe('GET /api/users/:userId', () => {
    it('should get user profile by ID', async () => {
      const response = await testRequest
        .get(`/api/users/${testUser._id}`)
        .set('Authorization', `Bearer ${accessToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user).toHaveProperty('email', testUser.email);
      expect(response.body.user).toHaveProperty('username', testUser.username);
      expect(response.body.user).not.toHaveProperty('password'); // Password should not be returned
    });
    
    it('should return 404 for non-existent user ID', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const response = await testRequest
        .get(`/api/users/${nonExistentId}`)
        .set('Authorization', `Bearer ${accessToken}`);
      
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('User not found');
    });
    
    it('should return 401 for unauthenticated request', async () => {
      const response = await testRequest
        .get(`/api/users/${testUser._id}`);
      
      expect(response.status).toBe(401);
    });
  });
  
  describe('PUT /api/users/:userId', () => {
    it('should update the user profile', async () => {
      const updateData = {
        username: 'updatedusername',
        bio: 'This is my updated bio'
      };
      
      const response = await testRequest
        .put(`/api/users/${testUser._id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user).toHaveProperty('username', 'updatedusername');
      expect(response.body.user).toHaveProperty('bio', 'This is my updated bio');
      
      // Verify the user was actually updated in the database
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.username).toBe('updatedusername');
      expect(updatedUser.bio).toBe('This is my updated bio');
    });
    
    it('should reject update from unauthorized user', async () => {
      const updateData = {
        username: 'hackerman',
        role: 'admin' // Attempting to elevate privileges
      };
      
      const response = await testRequest
        .put(`/api/users/${adminUser._id}`)
        .set('Authorization', `Bearer ${accessToken}`) // Regular user token
        .send(updateData);
      
      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      
      // Verify admin user was not changed
      const unchangedAdmin = await User.findById(adminUser._id);
      expect(unchangedAdmin.username).toBe('adminuser');
    });
  });
  
  describe('GET /api/users', () => {
    it('should allow admin to list all users with pagination', async () => {
      const response = await testRequest
        .get('/api/users?page=1&limit=10')
        .set('Authorization', `Bearer ${adminAccessToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.users)).toBe(true);
      expect(response.body.users.length).toBeGreaterThan(0);
      expect(response.body.pagination).toHaveProperty('currentPage', 1);
    });
    
    it('should reject regular user from listing all users', async () => {
      const response = await testRequest
        .get('/api/users')
        .set('Authorization', `Bearer ${accessToken}`);
      
      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('DELETE /api/users/:userId', () => {
    it('should allow admin to delete a user', async () => {
      // First create a user to delete
      const userToDelete = new User({
        username: 'deleteme',
        email: 'delete@example.com',
        password: bcrypt.hashSync('Password123!', bcrypt.genSaltSync(10)),
        verified: true
      });
      await userToDelete.save();
      
      const response = await testRequest
        .delete(`/api/users/${userToDelete._id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      // Verify user was actually deleted
      const deletedUser = await User.findById(userToDelete._id);
      expect(deletedUser).toBeNull();
    });
    
    it('should reject regular user from deleting another user', async () => {
      const response = await testRequest
        .delete(`/api/users/${adminUser._id}`)
        .set('Authorization', `Bearer ${accessToken}`);
      
      expect(response.status).toBe(403);
      
      // Verify admin still exists
      const adminStillExists = await User.findById(adminUser._id);
      expect(adminStillExists).not.toBeNull();
    });
  });
});

