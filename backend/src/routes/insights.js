const express = require("express");
const Resume = require("../models/Resume");
const ResumeVersion = require("../models/ResumeVersion");
const Analysis = require("../models/Analysis");
const asyncHandler = require("../utils/asyncHandler");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);

/**
 * GET /api/insights
 * Cross-resume analytics: score trend, top issues, keyword distribution, and performance.
 */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const [resumes, allAnalyses] = await Promise.all([
      Resume.find({ userId }).sort({ updatedAt: -1 }),
      Analysis.find({ userId }).sort({ createdAt: 1 }).populate("resumeId", "title"),
    ]);

    const totalAnalyses = allAnalyses.length;

    // Calculate score trend
    const scoreTrend = allAnalyses.map((a) => ({
      score: a.atsScore,
      at: a.createdAt,
      resumeTitle: a.resumeId?.title || "Resume",
    }));

    // Find best score & average
    let bestScoreObj = null;
    let scoreSum = 0;
    let scoredCount = 0;

    for (const r of resumes) {
      if (typeof r.bestScore === "number" && r.bestScore > 0) {
        scoreSum += r.bestScore;
        scoredCount++;
        if (!bestScoreObj || r.bestScore > bestScoreObj.value) {
          bestScoreObj = {
            value: r.bestScore,
            resumeId: String(r._id),
            resumeTitle: r.title,
          };
        }
      }
    }

    const averageScore = scoredCount > 0 ? Math.round(scoreSum / scoredCount) : 0;

    // Aggregate issues
    const issueMap = new Map();
    const missingKeywordMap = new Map();
    const presentKeywordMap = new Map();

    for (const a of allAnalyses) {
      // Issues
      for (const iss of a.issues || []) {
        const key = iss.title?.trim();
        if (!key) continue;
        const existing = issueMap.get(key) || { title: key, severity: iss.severity || "medium", count: 0 };
        existing.count += 1;
        issueMap.set(key, existing);
      }

      // Keywords
      for (const kw of a.keywordsMissing || []) {
        const key = kw?.trim();
        if (key) missingKeywordMap.set(key, (missingKeywordMap.get(key) || 0) + 1);
      }
      for (const kw of a.keywordsPresent || []) {
        const key = kw?.trim();
        if (key) presentKeywordMap.set(key, (presentKeywordMap.get(key) || 0) + 1);
      }
    }

    const topIssues = Array.from(issueMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const topMissingKeywords = Array.from(missingKeywordMap.entries())
      .map(([keyword, count]) => ({ keyword, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const topPresentKeywords = Array.from(presentKeywordMap.entries())
      .map(([keyword, count]) => ({ keyword, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Resume performance table
    const resumePerformance = [];
    for (const r of resumes) {
      const resumeAnalyses = allAnalyses.filter(
        (a) => a.resumeId && String(a.resumeId._id || a.resumeId) === String(r._id)
      );

      const firstScore = resumeAnalyses[0]?.atsScore || r.bestScore || 0;
      const latestScore = resumeAnalyses[resumeAnalyses.length - 1]?.atsScore || r.bestScore || 0;
      const improvement = Math.max(0, latestScore - firstScore);

      resumePerformance.push({
        resumeId: String(r._id),
        title: r.title,
        latestScore,
        bestScore: r.bestScore || latestScore,
        improvement,
        analysesCount: resumeAnalyses.length,
      });
    }

    res.json({
      averageScore,
      bestScore: bestScoreObj,
      totalAnalyses,
      scoreTrend,
      topIssues,
      topMissingKeywords,
      topPresentKeywords,
      resumePerformance,
    });
  })
);

module.exports = router;

