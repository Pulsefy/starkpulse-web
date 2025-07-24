const express = require("express");

const validatorRouter = express.Router();

// Register new validator
validatorRouter.post(
  "/register",
  [
    body("publicKey").notEmpty().withMessage("Public key is required"),
    body("stake").isNumeric().withMessage("Stake must be numeric"),
    body("specializations")
      .isArray()
      .withMessage("Specializations must be an array"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { validationNetwork } = req.app.locals;
      const validator = validationNetwork.registerValidator({
        id: `validator_${Date.now()}`,
        ...req.body,
      });

      res.json({
        success: true,
        validator: {
          id: validator.id,
          reputation: validator.reputation,
          status: validator.status,
        },
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Get validator information
validatorRouter.get("/:validatorId", async (req, res) => {
  try {
    const { validationNetwork } = req.app.locals;
    const validator = validationNetwork.validators.get(req.params.validatorId);

    if (!validator) {
      return res.status(404).json({ error: "Validator not found" });
    }

    res.json({
      id: validator.id,
      reputation: validator.reputation,
      stake: validator.stake,
      specializations: validator.specializations,
      status: validator.status,
      validationHistory: validator.validationHistory.slice(-10), // Last 10 validations
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all validators
validatorRouter.get("/", async (req, res) => {
  try {
    const { validationNetwork } = req.app.locals;
    const validators = Array.from(validationNetwork.validators.values()).map(
      (v) => ({
        id: v.id,
        reputation: v.reputation,
        stake: v.stake,
        status: v.status,
        specializations: v.specializations,
      })
    );

    res.json({ validators });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Slash validator
validatorRouter.post(
  "/:validatorId/slash",
  [
    body("reason").notEmpty().withMessage("Reason is required"),
    body("severity")
      .isIn(["minor", "medium", "major", "severe"])
      .withMessage("Invalid severity level"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { reputationSystem } = req.app.locals;
      const result = await reputationSystem.slashValidator(
        req.params.validatorId,
        req.body.reason,
        req.body.severity
      );

      res.json({
        success: true,
        slashing: result,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

module.exports = validatorRouter