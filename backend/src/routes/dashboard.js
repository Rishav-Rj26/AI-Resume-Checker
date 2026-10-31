const express = require("express");
const Resume = require("../models/Resume");
const ResumeVersion = require("../models/ResumeVersion");
const Analysis = require("../models/Analysis");
const Activity = require("../models/Activity");
const asyncHandler = require("../utils/asyncHandler");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);

/**
 * GET /api/dashboard
 * Aggregated dashboard payload matching frontend requirements.
 */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const userId = req.user._id;

    // Parallel counts and fetch
    const [
      resumesCount,
      analysesCount,
      rewriteVersionsCount,
      latestResume,
      activities,
      recentAnalyses,
    ] = await Promise.all([
      Resume.countDocuments({ userId }),
      Analysis.countDocuments({ userId }),
      ResumeVersion.countDocuments({ userId, sourceType: "rewrite" }),
      Resume.findOne({ userId }).sort({ updatedAt: -1 }).select("_id title currentVersionId bestScore"),
      Activity.find({ userId }).sort({ createdAt: -1 }).limit(10),
      Analysis.find({ userId }).sort({ createdAt: 1 }).limit(20).select("atsScore issues keywordsPresent scoreBreakdown createdAt"),
    ]);

    // Versions for latest resume
    let scoreSeries = [];
    let versionStack = [];
    if (latestResume) {
      const versions = await ResumeVersion.find({
        resumeId: latestResume._id,
        userId,
      })
        .sort({ createdAt: 1 })
        .select("_id label score sourceType createdAt");

      scoreSeries = versions.map((v) => ({
        label: v.label,
        score: v.score || 0,
      }));

      versionStack = versions.map((v) => ({
        id: String(v._id),
        label: v.label,
        title: v.sourceType === "upload" ? "Upload" : "Rewrite pass",
        score: v.score || 0,
      }));
    }

    // KPI metrics & sparks
    const totalVersions = await ResumeVersion.countDocuments({ userId });
    const latestAnalysis = recentAnalyses[recentAnalyses.length - 1];
    const firstAnalysis = recentAnalyses[0];

    const currentAts = latestAnalysis?.atsScore || latestResume?.bestScore || 0;
    const initialAts = firstAnalysis?.atsScore || currentAts;
    const atsDelta = currentAts - initialAts;

    const totalIssues = (latestAnalysis?.issues || []).length;
    const keywordsMatched = (latestAnalysis?.keywordsPresent || []).length;

    // Sparklines
    const atsSparks =
      recentAnalyses.length > 0
        ? recentAnalyses.map((a) => ({ v: a.atsScore }))
        : [{ v: currentAts }];

    const versionSparks = [];
    for (let i = 1; i <= Math.min(7, totalVersions || 1); i++) {
      versionSparks.push({ v: i });
    }

    const payload = {
      totals: {
        resumes: resumesCount,
        rewrites: rewriteVersionsCount,
        analyses: analysesCount,
      },
      latestResume: latestResume
        ? { _id: String(latestResume._id), title: latestResume.title }
        : null,
      scoreSeries,
      versionStack,
      kpi: {
        atsScore: {
          value: currentAts,
          delta: atsDelta,
          spark: atsSparks,
        },
        versions: {
          value: totalVersions,
          spark: versionSparks.length ? versionSparks : [{ v: 0 }],
        },
        issuesIdentified: {
          value: totalIssues,
          delta: totalIssues > 0 ? -Math.round(totalIssues * 1.5) : 0,
          spark: [{ v: totalIssues + 4 }, { v: totalIssues + 2 }, { v: totalIssues }],
        },
        keywordsMatched: {
          value: keywordsMatched,
          total: Math.max(keywordsMatched, 25),
          delta: Math.round(keywordsMatched * 0.4),
          spark: [{ v: Math.max(0, keywordsMatched - 6) }, { v: keywordsMatched }],
        },
      },
      activity: activities.map((a) => ({
        id: String(a._id),
        type: a.type,
        title: a.title,
        subtitle: a.subtitle,
        label: a.label,
        at: a.createdAt,
        resumeId: a.resumeId ? String(a.resumeId) : null,
      })),
    };

    res.json(payload);
  })
);

module.exports = router;

