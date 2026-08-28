import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { endpointGroups, endpointUsage, v2Endpoints } from "./endpoints.js";
import { Gw2ApiError, Gw2Client } from "./gw2-client.js";

const queryValue = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.union([z.string(), z.number()])),
]);

export function createServer(client: Gw2Client): McpServer {
  const server = new McpServer({ name: "guild-wars-2", version: "0.1.0" });

  server.registerTool(
    "gw2_api_get",
    {
      title: "Call the Guild Wars 2 API",
      description:
        "GET any official Guild Wars 2 API endpoint. Use paths such as v2/account, v2/items, v2/characters/My Character/inventory. Pass ids, page, page_size, lang, v, etc. in query. Set authenticated for account, character, guild-private, or commerce transaction data.",
      _meta: { securitySchemes: [{ type: "oauth2", scopes: ["gw2:read"] }] },
      inputSchema: {
        endpoint: z.string().describe("API path beginning with v2/ (or legacy v1/), without query string"),
        query: z.record(queryValue).optional().describe("GW2 query parameters; arrays become comma-separated values"),
        authenticated: z.boolean().default(false).describe("Fail early if no API key is available"),
      },
    },
    async (input) => {
      try {
        const result = await client.get(input);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: { result },
        };
      } catch (error) {
        const detail = error instanceof Gw2ApiError ? { status: error.status, body: error.body } : undefined;
        return {
          isError: true,
          content: [{ type: "text", text: JSON.stringify({ error: error instanceof Error ? error.message : String(error), ...detail }, null, 2) }],
        };
      }
    },
  );

  server.registerTool(
    "gw2_api_endpoints",
    {
      title: "Discover Guild Wars 2 API endpoints",
      description: "Lists the complete API v2 surface currently advertised by ArenaNet, grouped by route family, plus common query parameters.",
      _meta: { securitySchemes: [{ type: "oauth2", scopes: ["gw2:read"] }] },
      inputSchema: {},
    },
    async () => {
      const result = { count: v2Endpoints.length, usage: endpointUsage, groups: endpointGroups };
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    },
  );

  return server;
}
