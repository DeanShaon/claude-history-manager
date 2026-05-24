const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");
const http = require("node:http");
const path = require("node:path");

const BASE = "http://localhost:3334";

// Start server on a separate port for testing
let server;

before(async () => {
  const app = require("./index");
  // index.js already calls app.listen, so we just wait
  await new Promise((resolve) => setTimeout(resolve, 500));
});

after(() => {
  process.exit(0);
});

function get(endpoint) {
  return new Promise((resolve, reject) => {
    http.get(`${BASE}${endpoint}`, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
      res.on("error", reject);
    });
  });
}

describe("API Tests", () => {
  it("GET /api/projects returns project list", async () => {
    const result = await get("/api/projects");
    assert.ok(result.success, "Should return success");
    assert.ok(Array.isArray(result.projects), "projects should be an array");
    if (result.projects.length > 0) {
      assert.ok(result.projects[0].name, "first project should have a name");
      assert.ok(result.projects[0].path, "first project should have a path");
    }
  });

  it("GET /api/sessions requires path param", async () => {
    const result = await get("/api/sessions");
    assert.ok(result.error, "Should return error without path");
  });

  it("GET /api/session-detail requires filePath param", async () => {
    const result = await get("/api/session-detail");
    assert.ok(result.error, "Should return error without filePath");
  });

  it("GET /api/session-detail rejects path traversal", async () => {
    const result = await get("/api/session-detail?filePath=/etc/passwd");
    assert.equal(result.error, "禁止访问该路径");
  });

  it("GET /api/search requires query", async () => {
    const result = await get("/api/search");
    assert.ok(result.error, "Should return error without query");
  });

  it("GET /api/stats returns statistics", async () => {
    const result = await get("/api/stats");
    assert.ok(result.success, "Should return success");
    assert.ok(result.stats, "Should have stats object");
    assert.ok(typeof result.stats.totalProjects === "number");
    assert.ok(typeof result.stats.totalSessions === "number");
  });

  it("GET /api/security/scan returns results", async () => {
    const result = await get("/api/security/scan");
    assert.ok(result.success, "Should return success");
    assert.ok(Array.isArray(result.results), "results should be an array");
  });
});
