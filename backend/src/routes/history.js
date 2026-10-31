const express = require("express");
const Activity = require("../models/Activity");
const asyncHandler = require("../utils/asyncHandler");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);

/**
 * GET /api/history
 * Audit event log across all resumes for this user.
 */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const [events, totalCount, uploadCount, analyzeCount, rewriteCount] = await Promise.all([
      Activity.find({ userId }).sort({ createdAt: -1 }).limit(100),
      Activity.countDocuments({ userId }),
      Activity.countDocuments({ userId, type: "upload" }),
      Activity.countDocuments({ userId, type: { $in: ["analysis", "analyze"] } }),
      Activity.countDocuments({ userId, type: "rewrite" }),
    ]);

    const formatted = events.map((ev) => ({
      id: String(ev._id),
      type: ev.type === "analysis" ? "analyze" : ev.type,
      title: ev.title,
      subtitle: ev.subtitle,
      label: ev.label,
      at: ev.createdAt,
      resumeId: ev.resumeId ? String(ev.resumeId) : null,
    }));

    res.json({
      totals: {
        all: totalCount,
        upload: uploadCount,
        analyze: analyzeCount,
        rewrite: rewriteCount,
      },
      events: formatted,
    });
  })
);

module.exports = router;

