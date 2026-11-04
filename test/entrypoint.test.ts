import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";
import handler from "../index.js";
import { startStandaloneServer } from "../src/standalone.js";

test("Vercel Node entrypoint exports an HTTP handler", () => {
  assert.equal(typeof handler, "function");
});

test("standalone Node HTTP server serves MCP and OAuth discovery endpoints", async () => {
  const server = await startStandaloneServer(0, "127.0.0.1");
  try {
    const { port } = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${port}`;
    const response = await fetch(`${baseUrl}/.well-known/oauth-protected-resource`);
    assert.equal(response.status, 200);
    const metadata = (await response.json()) as { resource: string; authorization_servers: string[] };
    assert.equal(metadata.resource, `${baseUrl}/mcp`);
    assert.deepEqual(metadata.authorization_servers, [baseUrl]);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});
