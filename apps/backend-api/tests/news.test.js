const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../server');
const News = require('../src/models/News');
const newsService = require('../src/services/newsService');

jest.mock('../src/services/newsService');

let mongoServer;

// Sample news data for testing
const sampleNews = [
  {
    _id: new mongoose.Types.ObjectId(),
    title: 'Bitcoin surges to new high',
    content: 'Bitcoin price has reached a new all-time high today.',
    summary: 'Bitcoin hits new record price.',
    url: 'https://example.com/bitcoin-new-high',
    imageUrl: 'https://example.com/images/bitcoin.jpg',
    source: {
      name: 'CryptoNews',
      url: 'https://example.com'
    },
    author: 'John Doe',
    publishedAt: new Date(),
    categories: ['market', 'bitcoin'],
    tags: ['bitcoin', 'price', 'ath'],
    coins: ['btc'],
    sentiment: 'positive',
    popularity: 100,
    isActive: true,
    fetchedFrom: 'cryptonews'
  },
  {
    _id: new mongoose.Types.ObjectId(),
    title: 'Ethereum 2.0 upgrade completed',
    content: 'Ethereum has successfully completed its transition to proof-of-stake.',
    summary: 'Ethereum completes major network upgrade.',
    url: 'https://example.com/ethereum-upgrade',
    imageUrl: 'https://example.com/images/ethereum.jpg',
    source: {
      name: 'BlockchainTimes',
      url: 'https://example.com/blockchain'
    },
    author: 'Jane Smith',
    publishedAt: new Date(),
    categories: ['technology', 'ethereum'],
    tags: ['ethereum', 'pos', 'upgrade'],
    coins: ['eth'],
    sentiment: 'positive',
    popularity: 85,
    isActive: true,
    fetchedFrom: 'blockchaintimes'
  }
];

beforeAll(async () => {
  // Set up MongoDB Memory Server
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  // Clear database and seed with sample data
  await News.deleteMany({});
  await News.insertMany(sampleNews);
});

// Mock service functions
newsService.getNews.mockImplementation((query, options) => {
  return Promise.resolve(sampleNews);
});

newsService.countNews.mockImplementation((query) => {
  return Promise.resolve(sampleNews.length);
});

newsService.getTrendingNews.mockImplementation((limit) => {
  return Promise.resolve([sampleNews[0]]);
});

newsService.getNewsById.mockImplementation((id) => {
  const news = sampleNews.find(n => n._id.toString() === id);
  return Promise.resolve(news || null);
});

newsService.getCoinNews.mockImplementation((symbol, options) => {
  return Promise.resolve(sampleNews.filter(n => n.coins.includes(symbol)));
});

newsService.getNewsCategories.mockImplementation(() => {
  const categories = new Set();
  for (const news of sampleNews) {
    for (const category of news.categories) {
      categories.add(category);
    }
  }
  return Promise.resolve([...categories]);
});

newsService.getNewsSources.mockImplementation(() => {
  const sources = new Set();
  for (const news of sampleNews) {
    sources.add(news.source.name);
  }
  return Promise.resolve([...sources]);
});

newsService.incrementArticlePopularity.mockImplementation((id) => {
  return Promise.resolve({ ...sampleNews[0], popularity: sampleNews[0].popularity + 1 });
});

describe('News API Endpoints', () => {
  describe('GET /api/news', () => {
    it('should return all news with pagination', async () => {
      const res = await request(app)
        .get('/api/news')
        .expect('Content-Type', /json/)
        .expect(200);
      
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(2);
      expect(res.body.total).toBe(2);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.pagination).toHaveProperty('page');
      expect(res.body.pagination).toHaveProperty('limit');
    });

    it('should filter news by search term', async () => {
      const res = await request(app)
        .get('/api/news?search=bitcoin')
        .expect(200);
      
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/news/:id', () => {
    it('should return a single news article by ID', async () => {
      const id = sampleNews[0]._id.toString();
      const res = await request(app)
        .get(`/api/news/${id}`)
        .expect(200);
      
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('title');
    });

    it('should return 404 for non-existent news ID', async () => {
      newsService.getNewsById.mockImplementationOnce(() => Promise.resolve(null));
      
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .get(`/api/news/${nonExistentId}`)
        .expect(404);
    });
  });

  describe('GET /api/news/trending', () => {
    it('should return trending news articles', async () => {
      const res = await request(app)
        .get('/api/news/trending')
        .expect(200);
      
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe('Bitcoin surges to new high');
    });
  });

  describe('GET /api/news/categories', () => {
    it('should return all news categories', async () => {
      const res = await request(app)
        .get('/api/news/categories')
        .expect(200);
      
      expect(res.body.success).toBe(true);
      expect(res.body.data).toContain('market');
      expect(res.body.data).toContain('technology');
    });
  });

  describe('GET /api/news/sources', () => {
    it('should return all news sources', async () => {
      const res = await request(app)
        .get('/api/news/sources')
        .expect(200);
      
      expect(res.body.success).toBe(true);
      expect(res.body.data).toContain('CryptoNews');
      expect(res.body.data).toContain('BlockchainTimes');
    });
  });

  describe('GET /api/news/coin/:symbol', () => {
    it('should return news for a specific cryptocurrency', async () => {
      const res = await request(app)
        .get('/api/news/coin/btc')
        .expect(200);
      
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(1);
      expect(res.body.data[0].title).toBe('Bitcoin surges to new high');
    });
  });
});
