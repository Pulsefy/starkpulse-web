const AlertService = require("../services/AlertService");
const { validationResult } = require("express-validator");

class AlertController {
  async createAlert(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const alert = await AlertService.createAlert(req.user.id, req.body);

      res.status(201).json({
        success: true,
        data: alert,
        message: "Alert created successfully",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getAlerts(req, res) {
    try {
      const options = {
        isActive:
          req.query.active !== undefined
            ? req.query.active === "true"
            : undefined,
        symbol: req.query.symbol,
        limit: parseInt(req.query.limit) || 50,
      };

      const alerts = await AlertService.getUserAlerts(req.user.id, options);

      res.json({
        success: true,
        data: alerts,
        count: alerts.length,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getAlert(req, res) {
    try {
      const alert = await Alert.findOne({
        _id: req.params.id,
        userId: req.user.id,
      });

      if (!alert) {
        return res.status(404).json({
          success: false,
          message: "Alert not found",
        });
      }

      res.json({
        success: true,
        data: alert,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async updateAlert(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const alert = await AlertService.updateAlert(
        req.params.id,
        req.user.id,
        req.body
      );

      res.json({
        success: true,
        data: alert,
        message: "Alert updated successfully",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async deleteAlert(req, res) {
    try {
      await AlertService.deleteAlert(req.params.id, req.user.id);

      res.json({
        success: true,
        message: "Alert deleted successfully",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async toggleAlert(req, res) {
    try {
      const alert = await AlertService.updateAlert(req.params.id, req.user.id, {
        isActive: req.body.isActive,
      });

      res.json({
        success: true,
        data: alert,
        message: `Alert ${alert.isActive ? "activated" : "deactivated"}`,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
}

module.exports = new AlertController();
