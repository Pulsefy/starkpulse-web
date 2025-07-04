const cron = require("node-cron");
const AlertService = require("./AlertService");

class MonitoringService {
  constructor() {
    this.isRunning = false;
    this.cronJob = null;
  }

  start() {
    if (this.isRunning) {
      console.log("Monitoring service is already running");
      return;
    }

    // Check alerts every minute
    this.cronJob = cron.schedule("*/1 * * * *", async () => {
      try {
        await AlertService.checkAlerts();
      } catch (error) {
        console.error("Error in alert monitoring:", error);
      }
    });

    this.isRunning = true;
    console.log("Price alert monitoring service started");
  }

  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }

    this.isRunning = false;
    console.log("Price alert monitoring service stopped");
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      lastCheck: new Date(),
    };
  }
}

module.exports = new MonitoringService();
