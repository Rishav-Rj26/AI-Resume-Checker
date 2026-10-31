const mongoose = require("mongoose");

const analysisSchema = new mongoose.Schema(
  {
    resumeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Resume",
      required: true,
      index: true,
    },
    versionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ResumeVersion",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    targetRole: {
      type: String,
      default: "",
      trim: true,
    },
    atsScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    model: {
      type: String,
      default: "gemini-2.5-flash",
    },
    summary: {
      type: String,
      default: "",
    },
    scoreBreakdown: [
      {
        label: { type: String, required: true },
        value: { type: Number, required: true, min: 0, max: 100 },
      },
    ],
    issues: [
      {
        title: { type: String, required: true },
        severity: {
          type: String,
          enum: ["high", "medium", "med", "low"],
          default: "medium",
        },
        fix: { type: String, required: true },
      },
    ],
    strengths: [
      {
        title: { type: String, required: true },
        note: { type: String, required: true },
      },
    ],
    keywordsPresent: [{ type: String }],
    keywordsMissing: [{ type: String }],
    bulletRewrites: [
      {
        _id: { type: String, required: true },
        section: { type: String, default: "experience" },
        original: { type: String, required: true },
        rewritten: { type: String, required: true },
        rationale: { type: String, default: "" },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

analysisSchema.index({ resumeId: 1, createdAt: -1 });
analysisSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("Analysis", analysisSchema);

