const mongoose = require("mongoose");

const resumeVersionSchema = new mongoose.Schema(
  {
    resumeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Resume",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
      default: "V1",
    },
    sourceType: {
      type: String,
      enum: ["upload", "rewrite"],
      default: "upload",
    },
    score: {
      type: Number,
      default: null,
      min: 0,
      max: 100,
    },
    rawText: {
      type: String,
      default: "",
    },
    parsedSections: {
      basics: {
        name: { type: String, default: "" },
        title: { type: String, default: "" },
        email: { type: String, default: "" },
        phone: { type: String, default: "" },
        location: { type: String, default: "" },
        links: [
          {
            label: { type: String, default: "" },
            url: { type: String, default: "" },
          },
        ],
      },
      summary: { type: String, default: "" },
      experience: [
        {
          role: { type: String, default: "" },
          company: { type: String, default: "" },
          location: { type: String, default: "" },
          period: { type: String, default: "" },
          bullets: [{ type: String }],
        },
      ],
      education: [
        {
          degree: { type: String, default: "" },
          school: { type: String, default: "" },
          location: { type: String, default: "" },
          period: { type: String, default: "" },
          details: { type: String, default: "" },
        },
      ],
      skills: [{ type: String }],
      projects: [
        {
          name: { type: String, default: "" },
          tech: [{ type: String }],
          description: { type: String, default: "" },
          summary: { type: String, default: "" },
          links: [
            {
              label: { type: String, default: "" },
              url: { type: String, default: "" },
            },
          ],
        },
      ],
      certifications: [
        {
          name: { type: String, default: "" },
          year: { type: String, default: "" },
          issuer: { type: String, default: "" },
        },
      ],
      languages: [{ type: String }],
      interests: [{ type: String }],
    },
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

resumeVersionSchema.index({ resumeId: 1, createdAt: 1 });
resumeVersionSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("ResumeVersion", resumeVersionSchema);

