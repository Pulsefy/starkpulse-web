const { Queue, Worker } = require("bullmq");
const IORedis = require("ioredis");

let connection;

beforeAll(() => {
  connection = new IORedis({ host: "127.0.0.1", port: 6379, maxRetriesPerRequest: null });
});

afterAll(async () => {
  await connection.quit();
});

describe("Report Queue", () => {
  let reportQueue, reportWorker;

  beforeEach(() => {
    reportQueue = new Queue("reportQueue", { connection });
    reportWorker = new Worker(
      "reportQueue",
      async (job) => {
        if (job.name === "generateDailyReport") return { report: "daily" };
        if (job.name === "generateMonthlyReport") return { report: "monthly" };
      },
      { connection }
    );
  });

  afterEach(async () => {
    await reportWorker.close();
    await reportQueue.close();
  });

  test("should process daily report job", async () => {
    const job = await reportQueue.add("generateDailyReport", { date: "2025-08-27" });
    const result = await job.waitUntilFinished(reportWorker);
    expect(result).toEqual({ report: "daily" });
  });

  test("should process monthly report job", async () => {
    const job = await reportQueue.add("generateMonthlyReport", { month: "August" });
    const result = await job.waitUntilFinished(reportWorker);
    expect(result).toEqual({ report: "monthly" });
  });
});
