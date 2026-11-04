import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { ServerResponse } from "node:http";
import { createApiKeyProvider } from "../src/auth.js";
import { Gw2Client } from "../src/gw2-client.js";
import { requestOrigin, type VercelRequest } from "../src/http.js";
import { createServer } from "../src/mcp-server.js";
import { resolveAccessToken } from "../src/oauth.js";

function bearerToken(request: VercelRequest): string | undefined {
  const authorization = request.headers.authorization;
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || undefined;
}

/** Stateless MCP endpoint: every request owns its transport and GW2 credential. */
export default async function handler(request: VercelRequest, response: ServerResponse): Promise<void> {
  if (request.method !== "POST") {
    response.statusCode = request.method === "GET" ? 200 : 405;
    response.setHeader("Content-Type", "text/plain; charset=utf-8");
    response.setHeader("Allow", "GET, POST");
    response.end("MCP endpoint: send a Streamable HTTP POST request.");
    return;
  }

  const token = bearerToken(request);
  const origin = requestOrigin(request);
  const resource = `${origin}/mcp`;
  let gw2Key: string;
  try {
    if (!token) throw new Error("Missing access token");
    gw2Key = resolveAccessToken(token, resource);
  } catch {
    response.statusCode = 401;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.setHeader(
      "WWW-Authenticate",
      `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource", scope="gw2:read", error="invalid_token", error_description="Connect your Guild Wars 2 API key"`,
    );
    response.end(JSON.stringify({ error: "unauthorized" }));
    return;
  }

  const apiKey = createApiKeyProvider(() => gw2Key);
  const server = createServer(new Gw2Client(apiKey));
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  request.auth = { token, clientId: "mcp-client", scopes: ["gw2:read"] };
  await server.connect(transport);
  await transport.handleRequest(request, response, request.body);
}
