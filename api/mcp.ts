import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createApiKeyProvider } from "../src/auth.js";
import { Gw2Client } from "../src/gw2-client.js";
import { createServer } from "../src/server.js";

type VercelRequest = IncomingMessage & { body?: unknown; auth?: { token: string; clientId: string; scopes: string[] } };

function bearerToken(request: IncomingMessage): string | undefined {
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
  const apiKey = createApiKeyProvider(() => token);
  const server = createServer(new Gw2Client(apiKey));
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  if (token) request.auth = { token, clientId: "gw2-api-key", scopes: [] };
  await server.connect(transport);
  await transport.handleRequest(request, response, request.body);
}
