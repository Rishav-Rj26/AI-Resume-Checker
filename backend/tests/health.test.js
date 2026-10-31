const request = require("supertest");
const { app } = require("../src/server");
const { connectDB } = require("../src/config/db");
const mongoose = require("mongoose");

describe("Health & Documentation Endpoints", () => {
  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  it("GET /api/health should return 200 and healthy status", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.service).toBe("AI Resume Checker API");
    expect(res.body.database).toBe("connected");
  });

  it("GET /api-docs should serve OpenAPI Swagger documentation", async () => {
    const res = await request(app).get("/api-docs/");
    expect([200, 301]).toContain(res.status);
    if (res.status === 200) {
      expect(res.text).toContain("swagger");
    }
  });

  it("GET /undefined-route should return 404 with standard ApiError shape", async () => {
    const res = await request(app).get("/api/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.message).toContain("Route not found");
  });
});
