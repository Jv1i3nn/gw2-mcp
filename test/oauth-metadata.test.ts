import assert from "node:assert/strict";
import test from "node:test";
import { authorizationServerMetadata, protectedResourceMetadata } from "../src/oauth.js";

test("OAuth metadata binds tokens to the MCP resource and advertises PKCE", () => {
  const origin = "https://gw2-mcp.vercel.app";
  const resource = protectedResourceMetadata(origin);
  const authorization = authorizationServerMetadata(origin);

  assert.equal(resource.resource, `${origin}/mcp`);
  assert.deepEqual(resource.authorization_servers, [origin]);
  assert.equal(authorization.issuer, origin);
  assert.deepEqual(authorization.code_challenge_methods_supported, ["S256"]);
  assert.deepEqual(authorization.token_endpoint_auth_methods_supported, ["none"]);
  assert.equal(authorization.client_id_metadata_document_supported, true);
});
