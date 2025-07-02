const Alert = require("../models/Alert");
const NotificationService = require("./NotificationService");
const PriceService = require("./PriceService");

class AlertService {
  async createAlert(userId, alertData) {
    const alert = new Alert({
      userId,
      ...alertData,
    });

    await alert.save();
    return alert;
  }

  async getUserAlerts(userId, options = {}) {
    const query = { userId };

    if (options.isActive !== undefined) {
      query.isActive = options.isActive;
    }

    if (options.symbol) {
      query.symbol = options.symbol.toUpperCase();
    }

    return Alert.find(query)
      .sort({ createdAt: -1 })
      .limit(options.limit || 50);
  }

  async updateAlert(alertId, userId, updateData) {
    const alert = await Alert.findOneAndUpdate(
      { _id: alertId, userId },
      { ...updateData, isTriggered: false, triggeredAt: null },
      { new: true }
    );

    if (!alert) {
      throw new Error("Alert not found");
    }

    return alert;
  }

  async deleteAlert(alertId, userId) {
    const result = await Alert.deleteOne({ _id: alertId, userId });

    if (result.deletedCount === 0) {
      throw new Error("Alert not found");
    }

    return { success: true };
  }

  async checkAlerts() {
    const activeAlerts = await Alert.find({
      isActive: true,
      isTriggered: false,
    });

    console.log(`Checking ${activeAlerts.length} active alerts...`);

    const results = await Promise.allSettled(
      activeAlerts.map((alert) => this.checkSingleAlert(alert))
    );

    const triggered = results.filter(
      (r) => r.status === "fulfilled" && r.value
    ).length;
    const errors = results.filter((r) => r.status === "rejected").length;

    console.log(
      `Alert check complete: ${triggered} triggered, ${errors} errors`
    );

    return { triggered, errors, total: activeAlerts.length };
  }

  async checkSingleAlert(alert) {
    try {
      const shouldTrigger = await this.evaluateAlertCondition(alert);

      // Update last checked time
      alert.lastChecked = new Date();
      await alert.save();

      if (shouldTrigger) {
        await this.triggerAlert(alert, shouldTrigger.metadata);
        return true;
      }

      return false;
    } catch (error) {
      console.error(`Error checking alert ${alert._id}:`, error.message);
      throw error;
    }
  }

  async evaluateAlertCondition(alert) {
    const currentData = await PriceService.getCurrentPrice(alert.symbol);
    const currentPrice = currentData.price;

    let shouldTrigger = false;
    let metadata = {
      currentPrice,
      triggerPrice: currentPrice,
    };

    switch (alert.alertType) {
      case "PRICE_ABOVE":
        shouldTrigger = currentPrice >= alert.targetPrice;
        metadata.triggerPrice = alert.targetPrice;
        break;

      case "PRICE_BELOW":
        shouldTrigger = currentPrice <= alert.targetPrice;
        metadata.triggerPrice = alert.targetPrice;
        break;

      case "PERCENTAGE_CHANGE":
        const hoursAgo = this.getHoursFromTimeframe(alert.timeframe);
        const oldPrice = await PriceService.getHistoricalPrice(
          alert.symbol,
          hoursAgo
        );
        const changePercent = PriceService.calculatePercentageChange(
          currentPrice,
          oldPrice
        );

        shouldTrigger =
          Math.abs(changePercent) >= Math.abs(alert.percentageChange);
        metadata.changePercentage = changePercent;
        break;
    }

    return shouldTrigger ? { shouldTrigger: true, metadata } : false;
  }

  async triggerAlert(alert, metadata) {
    alert.isTriggered = true;
    alert.triggeredAt = new Date();
    alert.metadata = metadata;
    await alert.save();

    // Send notifications through all specified delivery methods
    const notifications = alert.deliveryMethods.map((method) =>
      NotificationService.sendNotification(alert, method, metadata)
    );

    await Promise.allSettled(notifications);

    console.log(`Alert ${alert._id} triggered for ${alert.symbol}`);
  }

  getHoursFromTimeframe(timeframe) {
    const map = { "1h": 1, "24h": 24, "7d": 168 };
    return map[timeframe] || 24;
  }
}

module.exports = new AlertService();
