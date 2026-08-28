import assert from "node:assert/strict";
import test from "node:test";
import { Gw2Client, normalizeEndpoint } from "../src/gw2-client.js";

test("normalizes a valid API endpoint", () => {
  assert.equal(normalizeEndpoint("/v2/account"), "v2/account");
});

test("rejects URLs and traversal", () => {
  assert.throws(() => normalizeEndpoint("https://evil.test/v2/account"));
  assert.throws(() => normalizeEndpoint("v2/../secret"));
  assert.throws(() => normalizeEndpoint("v2/items?ids=all"));
});

test("builds queries and sends the key as a bearer token", async () => {
  let capturedUrl = "";
  let capturedAuthorization: string | null = null;
  const fetcher: typeof fetch = async (input, init) => {
    capturedUrl = String(input);
    capturedAuthorization = new Headers(init?.headers).get("authorization");
    return new Response(JSON.stringify([{ id: 1 }]), { status: 200 });
  };
  const client = new Gw2Client(async () => "secret", fetcher);

  const result = await client.get({ endpoint: "v2/items", query: { ids: [1, 2], lang: "fr" } });

  assert.deepEqual(result, [{ id: 1 }]);
  assert.equal(capturedUrl, "https://api.guildwars2.com/v2/items?ids=1%2C2&lang=fr");
  assert.equal(capturedAuthorization, "Bearer secret");
});

test("requires a key only when requested", async () => {
  const client = new Gw2Client(async () => undefined, async () => new Response("{}"));
  await assert.rejects(() => client.get({ endpoint: "v2/account", authenticated: true }), /requires a Guild Wars 2 API key/);
});
