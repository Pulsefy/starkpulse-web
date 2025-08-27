const { Queue, Worker } = require("bullmq");
const IORedis = require("ioredis");

let connection;

beforeAll(() => {
  connection = new IORedis({ host: "127.0.0.1", port: 6379, maxRetriesPerRequest: null });
});

afterAll(async () => {
  await connection.quit();
});

describe("ETL Queue", () => {
  let etlQueue, etlWorker;

  beforeEach(() => {
    etlQueue = new Queue("etlQueue", { connection });
    etlWorker = new Worker(
      "etlQueue",
      async (job) => {
        if (job.name === "extract") return { extracted: true };
        if (job.name === "transform") return { transformed: true };
        if (job.name === "load") return { loaded: true };
      },
      { connection }
    );
  });

  afterEach(async () => {
    await etlWorker.close();
    await etlQueue.close();
  });

  test("should process extract job", async () => {
    const job = await etlQueue.add("extract", { source: "db" });
    const result = await job.waitUntilFinished(etlWorker);
    expect(result).toEqual({ extracted: true });
  });

  test("should process transform job", async () => {
    const job = await etlQueue.add("transform", { format: "json" });
    const result = await job.waitUntilFinished(etlWorker);
    expect(result).toEqual({ transformed: true });
  });

  test("should process load job", async () => {
    const job = await etlQueue.add("load", { target: "warehouse" });
    const result = await job.waitUntilFinished(etlWorker);
    expect(result).toEqual({ loaded: true });
  });
});
