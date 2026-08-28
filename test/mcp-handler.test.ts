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
