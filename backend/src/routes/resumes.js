const express = require("express");
const Resume = require("../models/Resume");
const ResumeVersion = require("../models/ResumeVersion");
const Analysis = require("../models/Analysis");
const Activity = require("../models/Activity");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { requireAuth } = require("../middleware/auth");
const upload = require("../middleware/upload");
const { uploadLimiter, aiLimiter } = require("../middleware/rateLimit");
const { extractTextFromPdf } = require("../services/pdfService");
const { parseResumeSections } = require("../services/structuredParser");
const { analyzeResume } = require("../services/geminiService");
const { computeDiff, serializeResumeSections } = require("../services/diffService");

const router = express.Router();

// All resume routes require authentication
router.use(requireAuth);

/**
 * GET /api/resumes
 * List all resumes for the authenticated user (shallow format)
 */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const resumes = await Resume.find({ userId: req.user._id })
      .sort({ updatedAt: -1 })
      .select("_id title createdAt updatedAt versionCount bestScore currentVersionId");

    res.json({ resumes });
  })
);

/**
 * POST /api/resumes
 * Upload a PDF resume, extract text, parse sections with AI, create Resume and Version V1
 */
router.post(
  "/",
  uploadLimiter,
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw ApiError.badRequest("Please select a PDF resume file to upload");
    }

    // 1. Extract text from PDF buffer
    const { text } = await extractTextFromPdf(req.file.buffer);

    // 2. Parse into structured sections (AI with heuristic fallback)
    const parsedSections = await parseResumeSections(text);

    // 3. Resolve title
    let title = (req.body?.title || "").trim();
    if (!title) {
      const candidateName = parsedSections.basics?.name;
      const candidateTitle = parsedSections.basics?.title;
      if (candidateName && candidateTitle) {
        title = `${candidateTitle} — ${candidateName}`;
      } else if (candidateName) {
        title = `${candidateName} Resume`;
      } else {
        title = req.file.originalname.replace(/\.pdf$/i, "");
      }
    }

    // 4. Create Resume container
    const resume = await Resume.create({
      userId: req.user._id,
      title,
      versionCount: 1,
      bestScore: null,
    });

    // 5. Create ResumeVersion (V1)
    const version = await ResumeVersion.create({
      resumeId: resume._id,
      userId: req.user._id,
      label: "V1",
      sourceType: "upload",
      score: null,
      rawText: text,
      parsedSections,
    });

    // 6. Link current version to resume
    resume.currentVersionId = version._id;
    await resume.save();

    // 7. Log upload activity
    const totalBullets = (parsedSections.experience || []).reduce(
      (sum, exp) => sum + (exp.bullets?.length || 0),
      0
    );
    await Activity.create({
      userId: req.user._id,
      resumeId: resume._id,
      versionId: version._id,
      type: "upload",
      title: `${req.file.originalname} uploaded`,
      subtitle: `Parsed ${Object.keys(parsedSections).length} sections, ${totalBullets} bullets`,
      label: "V1",
    });

    res.status(201).json({
      resume: {
        _id: resume._id,
        title: resume.title,
        createdAt: resume.createdAt,
        updatedAt: resume.updatedAt,
        currentVersionId: version._id,
        bestScore: resume.bestScore,
        versionCount: resume.versionCount,
      },
    });
  })
);

/**
 * GET /api/resumes/:id
 * Get resume detail with all version summaries
 */
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const resume = await Resume.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!resume) {
      throw ApiError.notFound("Resume not found");
    }

    const versions = await ResumeVersion.find({
      resumeId: resume._id,
      userId: req.user._id,
    })
      .sort({ createdAt: 1 })
      .select("_id label sourceType createdAt score rawText parsedSections");

    res.json({
      resume: {
        _id: resume._id,
        title: resume.title,
        createdAt: resume.createdAt,
        updatedAt: resume.updatedAt,
        currentVersionId: resume.currentVersionId,
        bestScore: resume.bestScore,
        versionCount: resume.versionCount,
      },
      versions,
    });
  })
);

/**
 * GET /api/resumes/:id/versions/:versionId
 * Get full version details with parsedSections
 */
router.get(
  "/:id/versions/:versionId",
  asyncHandler(async (req, res) => {
    const version = await ResumeVersion.findOne({
      _id: req.params.versionId,
      resumeId: req.params.id,
      userId: req.user._id,
    });

    if (!version) {
      throw ApiError.notFound("Version not found");
    }

    res.json({ version });
  })
);

/**
 * DELETE /api/resumes/:id
 * Delete resume and all associated versions, analyses, and activities
 */
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const resume = await Resume.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!resume) {
      throw ApiError.notFound("Resume not found");
    }

    await Promise.all([
      Resume.deleteOne({ _id: resume._id }),
      ResumeVersion.deleteMany({ resumeId: resume._id }),
      Analysis.deleteMany({ resumeId: resume._id }),
      Activity.deleteMany({ resumeId: resume._id }),
    ]);

    res.json({ ok: true });
  })
);

/**
 * GET /api/resumes/:id/analyses
 * Get all analyses for this resume
 */
router.get(
  "/:id/analyses",
  asyncHandler(async (req, res) => {
    const resume = await Resume.findOne({ _id: req.params.id, userId: req.user._id });
    if (!resume) throw ApiError.notFound("Resume not found");

    const analyses = await Analysis.find({ resumeId: resume._id, userId: req.user._id })
      .sort({ createdAt: -1 });

    res.json({ analyses });
  })
);

/**
 * GET /api/resumes/:id/versions/:versionId/analysis
 * Get latest analysis for a specific version
 */
router.get(
  "/:id/versions/:versionId/analysis",
  asyncHandler(async (req, res) => {
    const analysis = await Analysis.findOne({
      resumeId: req.params.id,
      versionId: req.params.versionId,
      userId: req.user._id,
    }).sort({ createdAt: -1 });

    if (!analysis) {
      throw ApiError.notFound("No analysis found for this version");
    }

    res.json({ analysis });
  })
);

/**
 * POST /api/resumes/:id/analyze
 * Run ATS scoring and analysis on a resume version
 */
router.post(
  "/:id/analyze",
  aiLimiter,
  asyncHandler(async (req, res) => {
    const resume = await Resume.findOne({ _id: req.params.id, userId: req.user._id });
    if (!resume) throw ApiError.notFound("Resume not found");

    const versionId = req.body?.versionId || resume.currentVersionId;
    const version = await ResumeVersion.findOne({
      _id: versionId,
      resumeId: resume._id,
      userId: req.user._id,
    });
    if (!version) throw ApiError.notFound("Version not found");

    const targetRole = (req.body?.targetRole || "").trim();

    // Call Gemini / ATS service
    const analysisData = await analyzeResume(
      version.parsedSections,
      version.rawText,
      targetRole
    );

    // Save Analysis record
    const analysis = await Analysis.create({
      resumeId: resume._id,
      versionId: version._id,
      userId: req.user._id,
      targetRole,
      atsScore: analysisData.atsScore,
      summary: analysisData.summary,
      scoreBreakdown: analysisData.scoreBreakdown,
      issues: analysisData.issues,
      strengths: analysisData.strengths,
      keywordsPresent: analysisData.keywordsPresent,
      keywordsMissing: analysisData.keywordsMissing,
      bulletRewrites: analysisData.bulletRewrites,
    });

    // Update version score
    version.score = analysisData.atsScore;
    await version.save();

    // Update resume bestScore
    if (resume.bestScore === null || analysisData.atsScore > resume.bestScore) {
      resume.bestScore = analysisData.atsScore;
      await resume.save();
    }

    // Log Activity
    await Activity.create({
      userId: req.user._id,
      resumeId: resume._id,
      versionId: version._id,
      type: "analyze",
      title: "ATS Analysis Completed",
      subtitle: `Target role: ${targetRole || "General"} · Score ${analysisData.atsScore}/100`,
      label: version.label,
    });

    res.json({ analysis });
  })
);

/**
 * POST /api/resumes/:id/rewrite
 * Apply selected bullet rewrites and create a new version (V2, V3...)
 */
router.post(
  "/:id/rewrite",
  aiLimiter,
  asyncHandler(async (req, res) => {
    const resume = await Resume.findOne({ _id: req.params.id, userId: req.user._id });
    if (!resume) throw ApiError.notFound("Resume not found");

    const { rewriteIds = [], analysisId } = req.body;
    let analysis;
    if (analysisId) {
      analysis = await Analysis.findOne({ _id: analysisId, resumeId: resume._id, userId: req.user._id });
    }
    if (!analysis) {
      analysis = await Analysis.findOne({ resumeId: resume._id, userId: req.user._id }).sort({ createdAt: -1 });
    }

    if (!analysis) {
      throw ApiError.badRequest("No analysis found. Run an ATS analysis before applying rewrites.");
    }

    const baseVersion = await ResumeVersion.findOne({
      _id: analysis.versionId,
      resumeId: resume._id,
      userId: req.user._id,
    });
    if (!baseVersion) {
      throw ApiError.notFound("Base version for rewrite not found");
    }

    // Deep clone parsed sections
    const newSections = JSON.parse(JSON.stringify(baseVersion.parsedSections || {}));
    const targetRewrites = (analysis.bulletRewrites || []).filter((rw) =>
      rewriteIds.length === 0 || rewriteIds.includes(rw._id)
    );

    let appliedCount = 0;

    for (const rw of targetRewrites) {
      let replaced = false;

      // 1. Check experience bullets
      if (Array.isArray(newSections.experience)) {
        for (const exp of newSections.experience) {
          if (Array.isArray(exp.bullets)) {
            for (let i = 0; i < exp.bullets.length; i++) {
              if (
                exp.bullets[i] === rw.original ||
                exp.bullets[i].trim().toLowerCase() === rw.original.trim().toLowerCase() ||
                (rw.original.length > 20 && exp.bullets[i].includes(rw.original.slice(0, 30)))
              ) {
                exp.bullets[i] = rw.rewritten;
                replaced = true;
                break;
              }
            }
          }
          if (replaced) break;
        }
      }

      // 2. Check summary
      if (!replaced && rw.section === "summary" && newSections.summary) {
        newSections.summary = rw.rewritten;
        replaced = true;
      }

      // 3. Check projects
      if (!replaced && Array.isArray(newSections.projects)) {
        for (const p of newSections.projects) {
          if (
            p.description &&
            (p.description === rw.original || p.description.includes(rw.original.slice(0, 30)))
          ) {
            p.description = rw.rewritten;
            replaced = true;
            break;
          }
        }
      }

      if (replaced) appliedCount++;
    }

    // Increment version count and calculate new score estimate
    const nextVersionNumber = (resume.versionCount || 1) + 1;
    const nextLabel = `V${nextVersionNumber}`;
    const estimatedScore = Math.min(
      98,
      Math.max(baseVersion.score || 70, (baseVersion.score || 70) + Math.max(5, appliedCount * 3))
    );

    const serializedText = serializeResumeSections(newSections);

    const newVersion = await ResumeVersion.create({
      resumeId: resume._id,
      userId: req.user._id,
      label: nextLabel,
      sourceType: "rewrite",
      score: estimatedScore,
      rawText: serializedText,
      parsedSections: newSections,
    });

    resume.versionCount = nextVersionNumber;
    resume.currentVersionId = newVersion._id;
    if (!resume.bestScore || estimatedScore > resume.bestScore) {
      resume.bestScore = estimatedScore;
    }
    await resume.save();

    await Activity.create({
      userId: req.user._id,
      resumeId: resume._id,
      versionId: newVersion._id,
      type: "rewrite",
      title: `Applied ${appliedCount} bullet rewrites`,
      subtitle: `Created version ${nextLabel}`,
      label: nextLabel,
    });

    res.status(201).json({
      version: newVersion,
      appliedCount,
    });
  })
);

/**
 * GET /api/resumes/:id/diff?from=:from&to=:to&mode=words|lines
 * Compare changes between two versions
 */
router.get(
  "/:id/diff",
  asyncHandler(async (req, res) => {
    const { from, to, mode = "words" } = req.query;

    if (!from || !to) {
      throw ApiError.badRequest("Both 'from' and 'to' version IDs are required");
    }

    const [versionA, versionB] = await Promise.all([
      ResumeVersion.findOne({ _id: from, resumeId: req.params.id, userId: req.user._id }),
      ResumeVersion.findOne({ _id: to, resumeId: req.params.id, userId: req.user._id }),
    ]);

    if (!versionA || !versionB) {
      throw ApiError.notFound("One or both versions not found for diff comparison");
    }

    const diffResult = computeDiff(versionA, versionB, mode);
    res.json(diffResult);
  })
);

module.exports = router;

