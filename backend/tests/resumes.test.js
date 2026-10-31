const request = require("supertest");
const { app } = require("../src/server");
const { connectDB } = require("../src/config/db");
const mongoose = require("mongoose");
const { PDFDocument, StandardFonts } = require("pdf-lib");
const User = require("../src/models/User");
const Resume = require("../src/models/Resume");
const ResumeVersion = require("../src/models/ResumeVersion");
const Analysis = require("../src/models/Analysis");
const Activity = require("../src/models/Activity");
const { signToken } = require("../src/utils/jwt");
const env = require("../src/config/env");

async function createTestPdf() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([600, 800]);
  const font = await doc.embedFont(StandardFonts.Helvetica);

  page.drawText("Riley Cooper", { x: 50, y: 750, size: 20, font });
  page.drawText("Frontend Developer | riley@example.com | 555-1212", { x: 50, y: 720, size: 10, font });
  page.drawText("EXPERIENCE", { x: 50, y: 680, size: 14, font });
  page.drawText("Web Developer | Alpha Inc | 2022 - 2024", { x: 50, y: 650, size: 11, font });
  page.drawText("- Built interactive web applications using React and Tailwind CSS.", { x: 60, y: 630, size: 10, font });
  page.drawText("- Worked on responsive components.", { x: 60, y: 610, size: 10, font });
  page.drawText("SKILLS", { x: 50, y: 570, size: 14, font });
  page.drawText("JavaScript, React, HTML5, CSS3, Tailwind, Git", { x: 50, y: 550, size: 10, font });

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

describe("Resumes, Analyses, Diff & Dashboard Integration", () => {
  const testEmail = `resumetest_${Date.now()}@example.com`;
  const testPassword = "SecurePassword123!";
  let authCookie = "";
  let resumeId = "";
  let v1Id = "";
  let v2Id = "";
  let testUser = null;

  beforeAll(async () => {
    await connectDB();

    testUser = await User.create({
      name: "Riley Cooper",
      email: testEmail,
      password: testPassword,
    });
    const token = signToken({ id: testUser._id });
    authCookie = `${env.COOKIE_NAME}=${token}`;
  });

  afterAll(async () => {
    if (resumeId) {
      await Resume.deleteOne({ _id: resumeId });
      await ResumeVersion.deleteMany({ resumeId });
      await Analysis.deleteMany({ resumeId });
      await Activity.deleteMany({ resumeId });
    }
    if (testUser) {
      await User.deleteOne({ _id: testUser._id });
    }
    await mongoose.connection.close();
  });

  it("POST /api/resumes - should upload PDF and create Resume V1", async () => {
    const pdfBuffer = await createTestPdf();

    const res = await request(app)
      .post("/api/resumes")
      .set("Cookie", authCookie)
      .attach("file", pdfBuffer, "Riley_Cooper_Resume.pdf");

    expect(res.status).toBe(201);
    expect(res.body.resume).toBeDefined();
    expect(res.body.resume._id).toBeDefined();
    expect(res.body.resume.versionCount).toBe(1);

    resumeId = res.body.resume._id;
    v1Id = res.body.resume.currentVersionId;
  });

  it("GET /api/resumes - should list user resumes", async () => {
    const res = await request(app)
      .get("/api/resumes")
      .set("Cookie", authCookie);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.resumes)).toBe(true);
    expect(res.body.resumes.length).toBeGreaterThan(0);
    expect(res.body.resumes[0]._id).toBe(resumeId);
  });

  it("GET /api/resumes/:id - should return resume detail and versions list", async () => {
    const res = await request(app)
      .get(`/api/resumes/${resumeId}`)
      .set("Cookie", authCookie);

    expect(res.status).toBe(200);
    expect(res.body.resume).toBeDefined();
    expect(res.body.versions.length).toBe(1);
    expect(res.body.versions[0].label).toBe("V1");
  });

  it("POST /api/resumes/:id/analyze - should analyze resume and generate ATS diagnostics", async () => {
    const res = await request(app)
      .post(`/api/resumes/${resumeId}/analyze`)
      .set("Cookie", authCookie)
      .send({ versionId: v1Id, targetRole: "Frontend Engineer" });

    expect(res.status).toBe(200);
    expect(res.body.analysis).toBeDefined();
    expect(res.body.analysis.atsScore).toBeGreaterThanOrEqual(0);
    expect(res.body.analysis.scoreBreakdown.length).toBe(5);
  });

  it("POST /api/resumes/:id/rewrite - should apply rewrites and spawn V2", async () => {
    const res = await request(app)
      .post(`/api/resumes/${resumeId}/rewrite`)
      .set("Cookie", authCookie)
      .send({ rewriteIds: [] });

    expect(res.status).toBe(201);
    expect(res.body.version).toBeDefined();
    expect(res.body.version.label).toBe("V2");

    v2Id = res.body.version._id;
  });

  it("GET /api/resumes/:id/diff - should calculate diff between V1 and V2", async () => {
    const res = await request(app)
      .get(`/api/resumes/${resumeId}/diff?from=${v1Id}&to=${v2Id}&mode=words`)
      .set("Cookie", authCookie);

    expect(res.status).toBe(200);
    expect(res.body.stats).toBeDefined();
    expect(Array.isArray(res.body.parts)).toBe(true);
  });

  it("GET /api/dashboard - should aggregate live KPI metrics and score series", async () => {
    const res = await request(app)
      .get("/api/dashboard")
      .set("Cookie", authCookie);

    expect(res.status).toBe(200);
    expect(res.body.totals.resumes).toBe(1);
    expect(res.body.totals.rewrites).toBe(1);
    expect(res.body.kpi.atsScore.value).toBeGreaterThan(0);
    expect(res.body.scoreSeries.length).toBe(2);
  });

  it("DELETE /api/resumes/:id - should delete resume with cascading cleanup", async () => {
    const res = await request(app)
      .delete(`/api/resumes/${resumeId}`)
      .set("Cookie", authCookie);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const remaining = await Resume.findById(resumeId);
    expect(remaining).toBeNull();
  });
});
