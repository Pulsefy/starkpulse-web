const express = require("express");

const governanceRouter = express.Router();

// Submit appeal for content decision
governanceRouter.post(
  "/appeals",
  [
    body("validationId").notEmpty().withMessage("Validation ID is required"),
    body("reason").notEmpty().withMessage("Appeal reason is required"),
    body("evidence").optional().isString(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const appeal = {
        id: `appeal_${Date.now()}`,
        validationId: req.body.validationId,
        reason: req.body.reason,
        evidence: req.body.evidence || "",
        status: "pending",
        submittedAt: new Date(),
        reviewBoard: [],
      };

      // In production, store in database
      res.json({
        success: true,
        appeal: {
          id: appeal.id,
          status: appeal.status,
          submittedAt: appeal.submittedAt,
        },
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Get governance metrics
governanceRouter.get("/metrics", async (req, res) => {
  try {
    const { validationNetwork } = req.app.locals;

    const metrics = {
      totalValidations: validationNetwork.activeValidations.size,
      networkHealth: validationNetwork.calculateNetworkHealth(),
      averageValidationTime: 0, // Calculate from historical data
      consensusRate: 0.95, // Calculate from historical data
      appealRate: 0.02, // Calculate from appeals
      validatorDistribution: {
        news: 5,
        analysis: 8,
        opinion: 3,
        investigation: 4,
      },
    };

    res.json({ metrics });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Check for conflicts of interest
governanceRouter.post(
  "/conflict-check",
  [
    body("validatorId").notEmpty().withMessage("Validator ID is required"),
    body("contentId").notEmpty().withMessage("Content ID is required"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Simplified conflict detection
      const conflicts = await checkConflictsOfInterest(
        req.body.validatorId,
        req.body.contentId
      );

      res.json({
        success: true,
        hasConflict: conflicts.length > 0,
        conflicts,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

async function checkConflictsOfInterest(validatorId, contentId) {
  // In production, check against database of relationships, financial interests, etc.
  const conflicts = [];

  // Example conflict checks:
  // - Financial interest in subject matter
  // - Personal relationship with author
  // - Previous public stance on topic
  // - Employment by related organization

  return conflicts;
}

module.exports = governanceRouter