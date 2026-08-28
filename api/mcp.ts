import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createApiKeyProvider } from "../src/auth.js";
import { Gw2Client } from "../src/gw2-client.js";
import { createServer } from "../src/server.js";

function bearerToken(request: Request): string | undefined {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || undefined;
}

/** Stateless MCP endpoint: every request owns its transport and GW2 credential. */
export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("MCP endpoint: send a Streamable HTTP POST request.", {
      status: request.method === "GET" ? 200 : 405,
      headers: request.method === "GET" ? undefined : { Allow: "GET, POST" },
    });
  }

  const token = bearerToken(request);
  const apiKey = createApiKeyProvider(() => token);
  const server = createServer(new Gw2Client(apiKey));
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  await server.connect(transport);
  return transport.handleRequest(request, {
    authInfo: token ? { token, clientId: "gw2-api-key", scopes: [] } : undefined,
  });
}
