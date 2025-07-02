const nodemailer = require("nodemailer");
const NotificationLog = require("../models/NotificationLog");

class NotificationService {
  constructor() {
    this.emailTransporter = this.setupEmailTransporter();
    this.websocketClients = new Map();
  }

  setupEmailTransporter() {
    return nodemailer.createTransporter({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendNotification(alert, method, metadata) {
    const log = new NotificationLog({
      alertId: alert._id,
      userId: alert.userId,
      method,
      status: "PENDING",
    });

    try {
      switch (method) {
        case "EMAIL":
          await this.sendEmailNotification(alert, metadata);
          break;
        case "PUSH":
          await this.sendPushNotification(alert, metadata);
          break;
        case "WEBSOCKET":
          await this.sendWebSocketNotification(alert, metadata);
          break;
      }

      log.status = "SENT";
      log.sentAt = new Date();
    } catch (error) {
      log.status = "FAILED";
      log.errorDetails = error.message;
      console.error(`Failed to send ${method} notification:`, error.message);
    }

    await log.save();
    return log;
  }

  async sendEmailNotification(alert, metadata) {
    if (!this.emailTransporter) {
      throw new Error("Email transporter not configured");
    }

    const subject = `Price Alert: ${alert.symbol}`;
    const message = this.formatAlertMessage(alert, metadata);

    // You'd need to populate user email from user model
    const mailOptions = {
      from: process.env.FROM_EMAIL || "alerts@yourapp.com",
      to: "user@example.com", // Get from user model
      subject,
      html: `
        <h2>${subject}</h2>
        <p>${message}</p>
        <hr>
        <small>You can manage your alerts in your dashboard.</small>
      `,
    };

    await this.emailTransporter.sendMail(mailOptions);
  }

  async sendPushNotification(alert, metadata) {
    // Implement push notification logic here
    // This would typically integrate with services like FCM, APNS, etc.
    console.log(
      "Push notification sent:",
      this.formatAlertMessage(alert, metadata)
    );
  }

  async sendWebSocketNotification(alert, metadata) {
    const client = this.websocketClients.get(alert.userId.toString());

    if (client && client.readyState === 1) {
      const notification = {
        type: "PRICE_ALERT",
        alertId: alert._id,
        symbol: alert.symbol,
        message: this.formatAlertMessage(alert, metadata),
        metadata,
        timestamp: new Date(),
      };

      client.send(JSON.stringify(notification));
    }
  }

  formatAlertMessage(alert, metadata) {
    const { currentPrice, triggerPrice, changePercentage } = metadata;

    switch (alert.alertType) {
      case "PRICE_ABOVE":
        return `${
          alert.symbol
        } has risen above $${triggerPrice}. Current price: $${currentPrice.toFixed(
          2
        )}`;
      case "PRICE_BELOW":
        return `${
          alert.symbol
        } has fallen below $${triggerPrice}. Current price: $${currentPrice.toFixed(
          2
        )}`;
      case "PERCENTAGE_CHANGE":
        return `${alert.symbol} has changed by ${changePercentage.toFixed(
          2
        )}% in the last ${
          alert.timeframe
        }. Current price: $${currentPrice.toFixed(2)}`;
      default:
        return `Price alert triggered for ${alert.symbol}`;
    }
  }

  registerWebSocketClient(userId, ws) {
    this.websocketClients.set(userId.toString(), ws);

    ws.on("close", () => {
      this.websocketClients.delete(userId.toString());
    });
  }
}

module.exports = new NotificationService();
