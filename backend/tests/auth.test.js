const request = require("supertest");
const { app } = require("../src/server");
const { connectDB } = require("../src/config/db");
const mongoose = require("mongoose");
const User = require("../src/models/User");

describe("Authentication & User Lifecycle", () => {
  const testEmail = `authtest_${Date.now()}@example.com`;
  const testPassword = "SecurePassword123!";
  let authCookie = "";

  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await User.deleteOne({ email: testEmail });
    await mongoose.connection.close();
  });

  it("POST /api/auth/register - should reject invalid inputs with Joi validation error", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "A", email: "invalid-email", password: "short" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it("POST /api/auth/register - should register a new user and set auth cookie", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Test Candidate", email: testEmail, password: testPassword });

    expect(res.status).toBe(201);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(testEmail);
    expect(res.body.user.password).toBeUndefined();

    const cookies = res.headers["set-cookie"];
    expect(cookies).toBeDefined();
    authCookie = cookies[0];
  });

  it("POST /api/auth/login - should fail with wrong password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: testEmail, password: "WrongPassword999!" });

    expect(res.status).toBe(401);
  });

  it("POST /api/auth/login - should succeed with correct credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: testEmail, password: testPassword });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(testEmail);
  });

  it("GET /api/auth/me - should return authenticated user profile", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Cookie", authCookie);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(testEmail);
  });

  it("PATCH /api/auth/profile - should update user display name", async () => {
    const res = await request(app)
      .patch("/api/auth/profile")
      .set("Cookie", authCookie)
      .send({ name: "Updated Candidate Name" });

    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe("Updated Candidate Name");
  });

  it("POST /api/auth/logout - should clear cookie", async () => {
    const res = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", authCookie);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

