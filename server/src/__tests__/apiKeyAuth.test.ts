import express from "express";
import request from "supertest";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { apiKeyAuth, getConfiguredApiKey } from "../api/middleware/apiKeyAuth.js";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/logs", apiKeyAuth, (_req, res) => {
    res.json({ success: true, data: "ok" });
  });
  // Health should never require auth
  app.get("/health", (_req, res) => res.json({ status: "ok" }));
  return app;
}

describe("apiKeyAuth middleware", () => {
  const originalEnv = process.env.API_KEY;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.API_KEY;
    } else {
      process.env.API_KEY = originalEnv;
    }
  });

  it("passes through when API_KEY is not set", async () => {
    delete process.env.API_KEY;
    const app = buildApp();
    const res = await request(app).get("/api/logs");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("passes through when API_KEY is empty string", async () => {
    process.env.API_KEY = "";
    const app = buildApp();
    const res = await request(app).get("/api/logs");
    expect(res.status).toBe(200);
  });

  it("returns 401 when API_KEY is set but no header provided", async () => {
    process.env.API_KEY = "my-secret-key-1234";
    const app = buildApp();
    const res = await request(app).get("/api/logs");
    expect(res.status).toBe(401);
    expect(res.body.errorCode).toBe("UNAUTHORIZED");
    expect(res.body.success).toBe(false);
  });

  it("returns 401 when wrong key is provided", async () => {
    process.env.API_KEY = "my-secret-key-1234";
    const app = buildApp();
    const res = await request(app)
      .get("/api/logs")
      .set("X-API-Key", "wrong-key");
    expect(res.status).toBe(401);
    expect(res.body.errorCode).toBe("UNAUTHORIZED");
  });

  it("passes when correct key is provided", async () => {
    process.env.API_KEY = "my-secret-key-1234";
    const app = buildApp();
    const res = await request(app)
      .get("/api/logs")
      .set("X-API-Key", "my-secret-key-1234");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("trims whitespace from API_KEY env var", async () => {
    process.env.API_KEY = "  my-key  ";
    const app = buildApp();
    const res = await request(app)
      .get("/api/logs")
      .set("X-API-Key", "my-key");
    expect(res.status).toBe(200);
  });

  describe("getConfiguredApiKey", () => {
    it("returns undefined when not set", () => {
      delete process.env.API_KEY;
      expect(getConfiguredApiKey()).toBeUndefined();
    });

    it("returns undefined for whitespace-only", () => {
      process.env.API_KEY = "   ";
      expect(getConfiguredApiKey()).toBeUndefined();
    });

    it("returns trimmed key", () => {
      process.env.API_KEY = " abc123 ";
      expect(getConfiguredApiKey()).toBe("abc123");
    });
  });
});
