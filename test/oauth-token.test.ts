import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { openToken, sealToken, verifyPkce } from "../src/oauth-token.js";

test("encrypted access tokens round-trip without exposing the GW2 key", () => {
  const previous = process.env.OAUTH_SECRET;
  process.env.OAUTH_SECRET = "test-only-secret";
  try {
    const token = sealToken({
      type: "access_token",
      gw2Key: "private-gw2-key",
      audience: "https://gw2-mcp.vercel.app/mcp",
      scope: "gw2:read",
      issuedAt: Date.now(),
      expiresAt: Date.now() + 60_000,
    });
    assert.ok(!token.includes("private-gw2-key"));
    assert.equal(openToken(token).gw2Key, "private-gw2-key");
    assert.throws(() => openToken(`${token.slice(0, -1)}x`), /Invalid token/);
  } finally {
    if (previous === undefined) delete process.env.OAUTH_SECRET;
    else process.env.OAUTH_SECRET = previous;
  }
});

test("PKCE accepts the matching S256 verifier only", () => {
  const verifier = "a".repeat(43);
  const challenge = createHash("sha256").update(verifier, "ascii").digest("base64url");
  assert.equal(verifyPkce(verifier, challenge), true);
  assert.equal(verifyPkce("b".repeat(43), challenge), false);
  assert.equal(verifyPkce("short", challenge), false);
});
