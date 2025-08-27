const { Queue, Worker } = require("bullmq");
const IORedis = require("ioredis");

let connection;

beforeAll(() => {
  connection = new IORedis({ host: "127.0.0.1", port: 6379, maxRetriesPerRequest: null });
});

afterAll(async () => {
  await connection.quit();
});

describe("Email Queue", () => {
  let emailQueue, emailWorker;

  beforeEach(() => {
    emailQueue = new Queue("emailQueue", { connection });
    emailWorker = new Worker(
      "emailQueue",
      async (job) => {
        if (job.name === "sendDailyDigest") {
          return { sent: true, type: "daily" };
        }
        if (job.name === "weeklyReport") {
          return { sent: true, type: "weekly" };
        }
      },
      { connection }
    );
  });

  afterEach(async () => {
    await emailWorker.close();
    await emailQueue.close();
  });

  test("should process daily digest job", async () => {
    const job = await emailQueue.add("sendDailyDigest", { timestamp: Date.now() });
    const result = await job.waitUntilFinished(emailWorker);
    expect(result).toEqual({ sent: true, type: "daily" });
  });

  test("should process weekly report job", async () => {
    const job = await emailQueue.add("weeklyReport", { timestamp: Date.now() });
    const result = await job.waitUntilFinished(emailWorker);
    expect(result).toEqual({ sent: true, type: "weekly" });
  });
});
