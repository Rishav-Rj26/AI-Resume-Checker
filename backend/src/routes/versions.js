const express = require("express");
const ResumeVersion = require("../models/ResumeVersion");
const asyncHandler = require("../utils/asyncHandler");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);

/**
 * GET /api/versions
 * List all versions across all resumes for this user.
 */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const [versions, totalCount, uploadCount, rewriteCount] = await Promise.all([
      ResumeVersion.find({ userId })
        .sort({ createdAt: -1 })
        .populate("resumeId", "title")
        .select("_id label resumeId sourceType score createdAt"),
      ResumeVersion.countDocuments({ userId }),
      ResumeVersion.countDocuments({ userId, sourceType: "upload" }),
      ResumeVersion.countDocuments({ userId, sourceType: "rewrite" }),
    ]);

    const formatted = versions.map((v) => ({
      id: String(v._id),
      label: v.label,
      resumeId: v.resumeId ? String(v.resumeId._id || v.resumeId) : null,
      resumeTitle: v.resumeId?.title || "Resume",
      sourceType: v.sourceType,
      score: v.score || 0,
      createdAt: v.createdAt,
    }));

    res.json({
      totals: {
        all: totalCount,
        uploads: uploadCount,
        rewrites: rewriteCount,
      },
      versions: formatted,
    });
  })
);

module.exports = router;

