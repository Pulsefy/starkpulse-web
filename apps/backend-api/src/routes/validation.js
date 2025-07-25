const express = require("express");
const { body, validationResult } = require("express-validator");

const router = express.Router();

// Submit content for validation
router.post(
  "/submit",
  [
    body("content.text").notEmpty().withMessage("Content text is required"),
    body("content.type")
      .isIn(["news", "analysis", "opinion", "investigation"])
      .withMessage("Invalid content type"),
    body("content.title").notEmpty().withMessage("Content title is required"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { validationNetwork } = req.app.locals;
      const validationId = await validationNetwork.submitContentForValidation(
        req.body.content
      );

      res.json({
        success: true,
        validationId,
        message: "Content submitted for validation",
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Get validation status
router.get("/status/:validationId", async (req, res) => {
  try {
    const { validationNetwork } = req.app.locals;
    const validation = validationNetwork.activeValidations.get(
      req.params.validationId
    );

    if (!validation) {
      return res.status(404).json({ error: "Validation not found" });
    }

    res.json({
      id: validation.id,
      status: validation.status,
      progress: validation.submissions.size / validation.validators.length,
      result: validation.result || null,
      deadline: validation.deadline,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Submit validator result
router.post(
  "/validate/:validationId",
  [
    body("validatorId").notEmpty().withMessage("Validator ID is required"),
    body("result.approved")
      .isBoolean()
      .withMessage("Approved decision is required"),
    body("result.signature").notEmpty().withMessage("Signature is required"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { validationNetwork } = req.app.locals;
      const validation = await validationNetwork.submitValidation(
        req.params.validationId,
        req.body.validatorId,
        req.body.result
      );

      res.json({
        success: true,
        validation: {
          id: validation.id,
          status: validation.status,
          submissions: validation.submissions.size,
        },
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
);

module.exports =  router;
