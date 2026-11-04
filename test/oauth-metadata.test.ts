import assert from "node:assert/strict";
import type { ServerResponse } from "node:http";
import test from "node:test";
import type { VercelRequest } from "../src/http.js";
import {
  authorizationServerMetadata,
  handleRegister,
  isAllowedRedirectUri,
  isValidClientId,
  protectedResourceMetadata,
} from "../src/oauth.js";

test("OAuth metadata binds tokens to the MCP resource and advertises PKCE + registration", () => {
  const origin = "https://gw2-mcp.vercel.app";
  const resource = protectedResourceMetadata(origin);
  const authorization = authorizationServerMetadata(origin);

  assert.equal(resource.resource, `${origin}/mcp`);
  assert.deepEqual(resource.authorization_servers, [origin]);
  assert.equal(authorization.issuer, origin);
  assert.equal(authorization.registration_endpoint, `${origin}/oauth/register`);
  assert.deepEqual(authorization.code_challenge_methods_supported, ["S256"]);
  assert.deepEqual(authorization.token_endpoint_auth_methods_supported, ["none"]);
  assert.equal(authorization.client_id_metadata_document_supported, true);
});

test("OAuth client validation accepts standard MCP clients (Claude, ChatGPT, loopback) and rejects insecure HTTP", () => {
  assert.equal(isValidClientId("https://chatgpt.com/oauth/client.json"), true);
  assert.equal(isValidClientId("mcp_123456"), true);
  assert.equal(isValidClientId(""), false);

  assert.equal(isAllowedRedirectUri("https://claude.ai/api/mcp/auth_callback"), true);
  assert.equal(isAllowedRedirectUri("https://chatgpt.com/connector_platform_oauth_redirect"), true);
  assert.equal(isAllowedRedirectUri("http://127.0.0.1:54321/callback"), true);
  assert.equal(isAllowedRedirectUri("http://localhost:3000/oauth/callback"), true);
  assert.equal(isAllowedRedirectUri("http://evil.example.com/callback"), false);
  assert.equal(isAllowedRedirectUri("https://claude.ai/callback#fragment"), false);
});

test("RFC 7591 dynamic client registration issues a stateless client_id", async () => {
  let status = 0;
  let payload = "";
  const request = {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: {
      client_name: "Claude",
      redirect_uris: ["https://claude.ai/api/mcp/auth_callback"],
    },
  } as unknown as VercelRequest;
  const response = {
    set statusCode(code: number) {
      status = code;
    },
    get statusCode() {
      return status;
    },
    setHeader() {},
    end(value: string) {
      payload = value;
    },
  } as unknown as ServerResponse;

  await handleRegister(request, response);

  assert.equal(status, 201);
  const parsed = JSON.parse(payload) as { client_id: string; client_name: string; redirect_uris: string[] };
  assert.match(parsed.client_id, /^mcp_/);
  assert.equal(parsed.client_name, "Claude");
  assert.deepEqual(parsed.redirect_uris, ["https://claude.ai/api/mcp/auth_callback"]);
});
