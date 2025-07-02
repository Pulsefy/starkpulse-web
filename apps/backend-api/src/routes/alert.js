const express = require("express");
const router = express.Router();
const AlertController = require("../controllers/alertController");
const { body, param } = require("express-validator");
const auth = require("../middleware/auth"); // Assuming you have auth middleware

// Validation middleware
const alertValidation = [
  body("symbol")
    .notEmpty()
    .trim()
    .toUpperCase()
    .withMessage("Symbol is required"),
  body("alertType")
    .isIn(["PRICE_ABOVE", "PRICE_BELOW", "PERCENTAGE_CHANGE"])
    .withMessage("Invalid alert type"),
  body("targetPrice")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Target price must be a positive number"),
  body("percentageChange")
    .optional()
    .isFloat()
    .withMessage("Percentage change must be a number"),
  body("timeframe")
    .optional()
    .isIn(["1h", "24h", "7d"])
    .withMessage("Invalid timeframe"),
  body("deliveryMethods")
    .isArray({ min: 1 })
    .withMessage("At least one delivery method is required"),
  body("deliveryMethods.*")
    .isIn(["EMAIL", "PUSH", "WEBSOCKET"])
    .withMessage("Invalid delivery method"),
];

const idValidation = [param("id").isMongoId().withMessage("Invalid alert ID")];

// Routes
router.post("/", auth, alertValidation, AlertController.createAlert);
router.get("/", auth, AlertController.getAlerts);
router.get("/:id", auth, idValidation, AlertController.getAlert);
router.put(
  "/:id",
  auth,
  idValidation,
  alertValidation,
  AlertController.updateAlert
);
router.delete("/:id", auth, idValidation, AlertController.deleteAlert);
router.patch("/:id/toggle", auth, idValidation, AlertController.toggleAlert);

module.exports = router;
