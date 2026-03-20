// @vitest-environment node

import express from "express";
import { AddressInfo } from "net";
import { afterEach, describe, expect, it } from "vitest";
import { registerRoutes } from "./routes";

const originalNodeEnv = process.env.NODE_ENV;
const originalAdminKey = process.env.ADMIN_API_KEY;

async function createTestServer() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  const server = await registerRoutes(app);

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  return { server, baseUrl };
}

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
  process.env.ADMIN_API_KEY = originalAdminKey;
});

describe("server security routes", () => {
  it("blocks admin endpoints in production without admin key", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.ADMIN_API_KEY;

    const { server, baseUrl } = await createTestServer();
    const response = await fetch(`${baseUrl}/api/admin/stats`);
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });

    expect(response.status).toBe(403);
  });

  it("allows admin endpoints with matching admin key", async () => {
    process.env.NODE_ENV = "production";
    process.env.ADMIN_API_KEY = "super-secret-key";

    const { server, baseUrl } = await createTestServer();
    const response = await fetch(`${baseUrl}/api/admin/stats`, {
      headers: {
        "x-admin-key": "super-secret-key",
      },
    });
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });

    expect(response.status).toBe(200);
  });

  it("creates non-predictable hex image ids for upload signing", async () => {
    process.env.NODE_ENV = "test";
    delete process.env.ADMIN_API_KEY;

    const { server, baseUrl } = await createTestServer();
    const payload = {
      filename: "image.png",
      contentType: "image/png",
      size: 1024,
    };

    const [first, second] = await Promise.all([
      fetch(`${baseUrl}/api/uploads/sign`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      }).then((res) => res.json() as Promise<{ image_id: string }>),
      fetch(`${baseUrl}/api/uploads/sign`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      }).then((res) => res.json() as Promise<{ image_id: string }>),
    ]);

    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });

    expect(first.image_id).toMatch(/^img_[0-9a-f]{16}$/);
    expect(second.image_id).toMatch(/^img_[0-9a-f]{16}$/);
    expect(first.image_id).not.toBe(second.image_id);
  });
});
