const userController = require('../../src/controllers/userController');
const mockData = require('../fixtures/mockData');

// Mock the User model and any other dependencies
jest.mock('../../src/models/User', () => ({
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn().mockReturnThis(),
  sort: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  exec: jest.fn(),
  countDocuments: jest.fn()
}));

describe('User Controller Unit Tests', () => {
  let mockReq;
  let mockRes;
  
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock request and response objects
    mockReq = {
      params: {},
      query: {},
      body: {},
      user: { _id: 'mock-user-id', email: 'test@example.com', role: 'user' }
    };
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
  });
  
  describe('getProfile', () => {
    it('should get the user profile successfully', async () => {
      // Arrange
      const mockUser = mockData.generateMockUser();
      mockReq.params.userId = mockUser._id.toString();
      require('../../src/models/User').findById.mockResolvedValueOnce(mockUser);
      
      // Act
      await userController.getProfile(mockReq, mockRes);
      
      // Assert
      expect(require('../../src/models/User').findById).toHaveBeenCalledWith(mockUser._id.toString());
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        user: expect.objectContaining({
          _id: mockUser._id,
          email: mockUser.email
        })
      });
    });
    
    it('should handle user not found error', async () => {
      // Arrange
      mockReq.params.userId = 'non-existent-id';
      require('../../src/models/User').findById.mockResolvedValueOnce(null);
      
      // Act
      await userController.getProfile(mockReq, mockRes);
      
      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'User not found'
      });
    });
  });
  
  describe('updateUserProfile', () => {
    it('should update user profile successfully', async () => {
      // Arrange
      const mockUser = mockData.generateMockUser();
      mockReq.params.userId = mockUser._id.toString();
      mockReq.user._id = mockUser._id.toString(); // Authenticated user is the same as the target user
      mockReq.body = {
        username: 'updatedUsername',
        bio: 'Updated bio information'
      };
      
      const updatedUser = {
        ...mockUser,
        username: 'updatedUsername',
        bio: 'Updated bio information'
      };
      
      require('../../src/models/User').findByIdAndUpdate.mockResolvedValueOnce(updatedUser);
      
      // Act
      await userController.updateProfile(mockReq, mockRes);
      
      // Assert
      expect(require('../../src/models/User').findByIdAndUpdate).toHaveBeenCalledWith(
        mockUser._id.toString(),
        { $set: mockReq.body },
        { new: true }
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'User profile updated successfully',
        user: updatedUser
      });
    });
    
    it('should reject unauthorized profile update', async () => {
      // Arrange
      mockReq.params.userId = 'other-user-id';
      mockReq.user._id = 'current-user-id'; // Authenticated user is different from the target user
      mockReq.user.role = 'user'; // Not an admin
      
      // Act
      await userController.updateProfile(mockReq, mockRes);
      
      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'You are not authorized to update this profile'
      });
    });
  });
  
  describe('getUsers', () => {
    it('should get all users with pagination', async () => {
      // Arrange
      mockReq.user.role = 'admin'; // Only admins can get all users
      mockReq.query = { page: '1', limit: '10' };
      
      const mockUsers = Array(10).fill().map(() => mockData.generateMockUser());
      require('../../src/models/User').exec.mockResolvedValueOnce(mockUsers);
      require('../../src/models/User').countDocuments.mockResolvedValueOnce(25); // Total 25 users
      
      // Act
      await userController.getUsers(mockReq, mockRes);
      
      // Assert
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        users: mockUsers,
        pagination: {
          totalUsers: 25,
          currentPage: 1,
          totalPages: 3,
          limit: 10
        }
      });
    });
    
    it('should reject non-admin users', async () => {
      // Arrange
      mockReq.user.role = 'user'; // Not an admin
      
      // Act
      await userController.getUsers(mockReq, mockRes);
      
      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Unauthorized: Admin access required'
      });
    });
  });
});

