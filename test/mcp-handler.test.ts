import assert from "node:assert/strict";
import test from "node:test";
import handler from "../api/mcp.js";

test("Vercel Node handler answers GET through the response object", async () => {
  let body: unknown;
  const request = { method: "GET", headers: {} };
  const response = {
    statusCode: 0,
    setHeader() {},
    end(value: unknown) {
      body = value;
    },
  };

  await (handler as unknown as (request: unknown, response: unknown) => Promise<void>)(request, response);

  assert.equal(response.statusCode, 200);
  assert.equal(body, "MCP endpoint: send a Streamable HTTP POST request.");
});

test("Vercel Node handler challenges unauthenticated MCP requests", async () => {
  let body: unknown;
  const headers = new Map<string, unknown>();
  const request = { method: "POST", headers: { host: "gw2-mcp.vercel.app", "x-forwarded-proto": "https" } };
  const response = {
    statusCode: 0,
    setHeader(name: string, value: unknown) { headers.set(name.toLowerCase(), value); },
    end(value: unknown) { body = value; },
  };

  await (handler as unknown as (request: unknown, response: unknown) => Promise<void>)(request, response);

  assert.equal(response.statusCode, 401);
  assert.match(String(headers.get("www-authenticate")), /oauth-protected-resource/);
  assert.equal(body, JSON.stringify({ error: "unauthorized" }));
});
