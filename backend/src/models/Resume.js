const mongoose = require("mongoose");

const resumeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, "Resume title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    currentVersionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ResumeVersion",
      default: null,
    },
    bestScore: {
      type: Number,
      default: null,
      min: 0,
      max: 100,
    },
    versionCount: {
      type: Number,
      default: 1,
      min: 1,
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

resumeSchema.index({ userId: 1, updatedAt: -1 });

module.exports = mongoose.model("Resume", resumeSchema);

