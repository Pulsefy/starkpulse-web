const { Queue, Worker } = require("bullmq");
const IORedis = require("ioredis");

let connection;

beforeAll(() => {
  connection = new IORedis({ host: "127.0.0.1", port: 6379, maxRetriesPerRequest: null });
});

afterAll(async () => {
  await connection.quit();
});

describe("Maintenance Queue", () => {
  let maintenanceQueue, maintenanceWorker;

  beforeEach(() => {
    maintenanceQueue = new Queue("maintenanceQueue", { connection });
    maintenanceWorker = new Worker(
      "maintenanceQueue",
      async (job) => {
        if (job.name === "cleanupTemp") return { cleaned: true };
        if (job.name === "backupDb") return { backup: "done" };
      },
      { connection }
    );
  });

  afterEach(async () => {
    await maintenanceWorker.close();
    await maintenanceQueue.close();
  });

  test("should process cleanup job", async () => {
    const job = await maintenanceQueue.add("cleanupTemp", { path: "/tmp" });
    const result = await job.waitUntilFinished(maintenanceWorker);
    expect(result).toEqual({ cleaned: true });
  });

  test("should process backup job", async () => {
    const job = await maintenanceQueue.add("backupDb", { db: "nftopia" });
    const result = await job.waitUntilFinished(maintenanceWorker);
    expect(result).toEqual({ backup: "done" });
  });
});
