class ManipulationDetection {
  constructor() {
    this.suspiciousPatterns = new Map();
    this.validatorBehaviorAnalysis = new Map();
  }

  detectCoordination(validationId, submissions) {
    const timestamps = Array.from(submissions.values()).map((s) => s.timestamp);
    const results = Array.from(submissions.values()).map((s) => s.result);

    // Check for coordinated timing
    const coordinatedTiming = this.checkCoordinatedTiming(timestamps);

    // Check for identical responses
    const identicalResponses = this.checkIdenticalResponses(results);

    // Check for suspicious validator groupings
    const suspiciousGrouping = this.checkValidatorGrouping(
      Array.from(submissions.keys())
    );

    return {
      suspicious: coordinatedTiming || identicalResponses || suspiciousGrouping,
      patterns: {
        coordinatedTiming,
        identicalResponses,
        suspiciousGrouping,
      },
      confidence: this.calculateSuspicionConfidence([
        coordinatedTiming,
        identicalResponses,
        suspiciousGrouping,
      ]),
    };
  }

  checkCoordinatedTiming(timestamps) {
    if (timestamps.length < 2) return false;

    timestamps.sort();
    const intervals = [];

    for (let i = 1; i < timestamps.length; i++) {
      intervals.push(timestamps[i] - timestamps[i - 1]);
    }

    // Check if submissions came in suspiciously close together
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    return avgInterval < 30000; // Less than 30 seconds average
  }

  checkIdenticalResponses(results) {
    const responseHashes = results.map((r) => this.hashResponse(r));
    const uniqueHashes = new Set(responseHashes);

    // Suspicious if more than 50% of responses are identical
    return uniqueHashes.size / responseHashes.length < 0.5;
  }

  checkValidatorGrouping(validatorIds) {
    // Check if same group of validators consistently validate together
    const groupKey = validatorIds.sort().join(",");
    const count = this.suspiciousPatterns.get(groupKey) || 0;
    this.suspiciousPatterns.set(groupKey, count + 1);

    return count > 3; // Same group validated together more than 3 times
  }

  hashResponse(result) {
    return JSON.stringify({
      approved: result.approved,
      factAccuracy: Math.round(result.factAccuracy * 10) / 10,
      sourceReliability: Math.round(result.sourceReliability * 10) / 10,
    });
  }

  calculateSuspicionConfidence(patterns) {
    const suspiciousCount = patterns.filter((p) => p).length;
    return suspiciousCount / patterns.length;
  }

  async analyzeValidatorBehavior(validatorId) {
    const behavior = this.validatorBehaviorAnalysis.get(validatorId) || {
      totalValidations: 0,
      approvalRate: 0,
      averageResponseTime: 0,
      consistencyScore: 0,
    };

    return {
      validatorId,
      behavior,
      riskLevel: this.calculateRiskLevel(behavior),
      recommendations: this.generateRecommendations(behavior),
    };
  }

  calculateRiskLevel(behavior) {
    let risk = 0;

    // Extreme approval rates are suspicious
    if (behavior.approvalRate > 0.95 || behavior.approvalRate < 0.05)
      risk += 0.3;

    // Very fast responses might indicate automation
    if (behavior.averageResponseTime < 60000) risk += 0.2; // Less than 1 minute

    // Low consistency might indicate random voting
    if (behavior.consistencyScore < 0.3) risk += 0.2;

    if (risk > 0.6) return "high";
    if (risk > 0.3) return "medium";
    return "low";
  }

  generateRecommendations(behavior) {
    const recommendations = [];

    if (behavior.approvalRate > 0.95) {
      recommendations.push(
        "Review approval criteria - approval rate unusually high"
      );
    }

    if (behavior.averageResponseTime < 60000) {
      recommendations.push(
        "Investigate response times - may indicate automated responses"
      );
    }

    if (behavior.consistencyScore < 0.3) {
      recommendations.push(
        "Monitor decision consistency - scores vary significantly"
      );
    }

    return recommendations;
  }
}
