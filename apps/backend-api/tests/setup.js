// Test environment setup
// Configure test environment here

// Set NODE_ENV before any other imports
process.env.NODE_ENV = 'development';

const path = require('node:path');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const dotenv = require('dotenv');
const supertest = require('supertest');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Now load the server after environment is properly set up
const app = require('../server');

// Global test timeout
jest.setTimeout(30000);

// Mocking global services
jest.mock('../src/config/redis', () => ({
  getClient: jest.fn().mockReturnValue({
    connect: jest.fn().mockResolvedValue(true),
    disconnect: jest.fn().mockResolvedValue(true),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
  }),
}));

// Global variables for tests
global.testRequest = supertest(app);
global.testUtils = {
  // Common test utilities
  generateMockUser: () => ({
    username: `user_${Math.floor(Math.random() * 10000)}`,
    email: `test_${Math.floor(Math.random() * 10000)}@example.com`,
    password: 'Password123!',
  }),
};

// Setup and teardown for MongoDB
let mongoServer;

// Setup global beforeAll hook to ensure MongoDB is connected before any tests run
beforeAll(async () => {
  // Create MongoDB Memory Server
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  // Override MongoDB URI for testing
  process.env.MONGODB_URI = mongoUri;
  
  // Connect to the in-memory database with explicit options
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    // Increase connection timeout for slower CI environments
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000
  });
  
  // Verify connection
  const connection = mongoose.connection;
  connection.on('error', console.error.bind(console, 'MongoDB connection error:'));
  connection.once('open', () => {
    console.log('Connected to in-memory MongoDB for testing');
  });
});

afterAll(async () => {
  // Clean up
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
});

// Clear collections after each test
afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});
