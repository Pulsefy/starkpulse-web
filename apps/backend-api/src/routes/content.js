const express = require("express");
const { ContentVerification } = require("../services/ContentVerification");

const contentRouter = express.Router();

// Verify content automatically
contentRouter.post(
  "/verify",
  [
    body("text").notEmpty().withMessage("Content text is required"),
    body("sources").optional().isArray(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const contentVerification = new ContentVerification();
      const verification = await contentVerification.verifyContent(req.body);

      res.json({
        success: true,
        verification,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Check content for plagiarism
contentRouter.post(
  "/plagiarism-check",
  [body("text").notEmpty().withMessage("Content text is required")],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const contentVerification = new ContentVerification();
      const plagiarismResult = await contentVerification.detectPlagiarism(
        req.body
      );

      res.json({
        success: true,
        plagiarism: plagiarismResult,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Analyze content bias
contentRouter.post(
  "/bias-analysis",
  [body("text").notEmpty().withMessage("Content text is required")],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const contentVerification = new ContentVerification();
      const biasAnalysis = await contentVerification.analyzeBias(req.body);

      res.json({
        success: true,
        bias: biasAnalysis,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);


module.exports = contentRouter