const authController = require('../../src/controllers/authController');
const authService = require('../../src/services/authService');

// Mock the auth service
jest.mock('../../src/services/authService');

describe('Auth Controller Unit Tests', () => {
  let mockReq;
  let mockRes;
  
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock request and response objects
    mockReq = {
      validatedData: {},
      headers: { 'user-agent': 'Test User Agent' },
      user: { _id: 'mock-user-id', email: 'test@example.com' },
      body: {}
    };
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
  });
  
  describe('register', () => {
    it('should register a new user successfully', async () => {
      // Arrange
      mockReq.validatedData = {
        email: 'test@example.com',
        password: 'Password123!',
        username: 'testuser'
      };
      
      const mockResult = {
        user: { _id: 'user-id', email: 'test@example.com', username: 'testuser' },
        tokens: { accessToken: 'mock-access-token', refreshToken: 'mock-refresh-token' }
      };
      
      authService.registerUser.mockResolvedValueOnce(mockResult);
      
      // Act
      await authController.register(mockReq, mockRes);
      
      // Assert
      expect(authService.registerUser).toHaveBeenCalledWith(
        mockReq.validatedData,
        'Test User Agent'
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'User registered successfully',
        user: mockResult.user,
        tokens: mockResult.tokens
      });
    });
    
    it('should handle duplicate email error', async () => {
      // Arrange
      mockReq.validatedData = {
        email: 'existing@example.com',
        password: 'Password123!',
        username: 'existinguser'
      };
      
      authService.registerUser.mockRejectedValueOnce(new Error('User with this email already exists'));
      
      // Act
      await authController.register(mockReq, mockRes);
      
      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'User with this email already exists'
      });
    });
    
    it('should handle general registration errors', async () => {
      // Arrange
      mockReq.validatedData = {
        email: 'test@example.com',
        password: 'Password123!',
        username: 'testuser'
      };
      
      authService.registerUser.mockRejectedValueOnce(new Error('Database error'));
      
      // Act
      await authController.register(mockReq, mockRes);
      
      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Registration failed'
      });
    });
  });
  
  describe('login', () => {
    it('should login a user successfully', async () => {
      // Arrange
      mockReq.validatedData = {
        email: 'test@example.com',
        password: 'Password123!'
      };
      
      const mockResult = {
        user: { _id: 'user-id', email: 'test@example.com' },
        tokens: { accessToken: 'mock-access-token', refreshToken: 'mock-refresh-token' }
      };
      
      authService.loginUser.mockResolvedValueOnce(mockResult);
      
      // Act
      await authController.login(mockReq, mockRes);
      
      // Assert
      expect(authService.loginUser).toHaveBeenCalledWith(
        'test@example.com',
        'Password123!',
        'Test User Agent'
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Login successful',
        user: mockResult.user,
        tokens: mockResult.tokens
      });
    });
    
    it('should handle invalid credentials', async () => {
      // Arrange
      mockReq.validatedData = {
        email: 'test@example.com',
        password: 'WrongPassword'
      };
      
      authService.loginUser.mockRejectedValueOnce(new Error('Invalid credentials'));
      
      // Act
      await authController.login(mockReq, mockRes);
      
      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid credentials'
      });
    });
    
    it('should handle account lockout', async () => {
      // Arrange
      mockReq.validatedData = {
        email: 'test@example.com',
        password: 'Password123!'
      };
      
      authService.loginUser.mockRejectedValueOnce(
        new Error('Account temporarily locked due to too many failed login attempts')
      );
      
      // Act
      await authController.login(mockReq, mockRes);
      
      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(423);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Account temporarily locked due to too many failed login attempts'
      });
    });
  });
  
  describe('refreshToken', () => {
    it('should refresh tokens successfully', async () => {
      // Arrange
      mockReq.body = { refreshToken: 'valid-refresh-token' };
      
      const mockTokens = { 
        accessToken: 'new-access-token', 
        refreshToken: 'new-refresh-token' 
      };
      
      authService.refreshTokens.mockResolvedValueOnce(mockTokens);
      
      // Act
      await authController.refreshToken(mockReq, mockRes);
      
      // Assert
      expect(authService.refreshTokens).toHaveBeenCalledWith('valid-refresh-token', 'Test User Agent');
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Tokens refreshed successfully',
        tokens: mockTokens
      });
    });
    
    it('should handle expired refresh token', async () => {
      // Arrange
      mockReq.body = { refreshToken: 'expired-refresh-token' };
      
      authService.refreshTokens.mockRejectedValueOnce(new Error('Refresh token expired'));
      
      // Act
      await authController.refreshToken(mockReq, mockRes);
      
      // Assert
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Refresh token expired',
        code: 'REFRESH_TOKEN_EXPIRED'
      });
    });
  });
  
  describe('logout', () => {
    it('should logout a user successfully', async () => {
      // Arrange
      mockReq.body = { refreshToken: 'valid-refresh-token' };
      
      authService.logoutUser.mockResolvedValueOnce(true);
      
      // Act
      await authController.logout(mockReq, mockRes);
      
      // Assert
      expect(authService.logoutUser).toHaveBeenCalledWith(mockReq.user, 'valid-refresh-token');
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Logout successful'
      });
    });
  });
  
  describe('logoutAll', () => {
    it('should logout a user from all devices successfully', async () => {
      // Arrange
      authService.logoutAllDevices.mockResolvedValueOnce(true);
      
      // Act
      await authController.logoutAll(mockReq, mockRes);
      
      // Assert
      expect(authService.logoutAllDevices).toHaveBeenCalledWith(mockReq.user);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Logged out from all devices successfully'
      });
    });
  });
});
