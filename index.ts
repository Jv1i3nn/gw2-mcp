import type { ServerResponse } from "node:http";
import handleMcp from "./api/mcp.js";
import { requestOrigin, requestUrl, sendHtml, sendJson, type VercelRequest } from "./src/http.js";
import {
  authorizationServerMetadata,
  handleAuthorize,
  handleRegister,
  handleToken,
  protectedResourceMetadata,
} from "./src/oauth.js";

/** Single Vercel Node entrypoint routing MCP and OAuth requests. */
export default async function handler(request: VercelRequest, response: ServerResponse): Promise<void> {
  const pathname = requestUrl(request).pathname;
  const origin = requestOrigin(request);

  if (pathname === "/mcp" || pathname === "/api/mcp") return handleMcp(request, response);
  if (pathname === "/.well-known/oauth-protected-resource") {
    sendJson(response, 200, protectedResourceMetadata(origin));
    return;
  }
  if (pathname === "/.well-known/oauth-authorization-server") {
    sendJson(response, 200, authorizationServerMetadata(origin));
    return;
  }
  if (pathname === "/oauth/authorize") return handleAuthorize(request, response);
  if (pathname === "/oauth/token") return handleToken(request, response);
  if (pathname === "/oauth/register") return handleRegister(request, response);
  if (pathname === "/") {
    sendHtml(response, 200, `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Guild Wars 2 MCP</title></head><body><main><h1>Guild Wars 2 MCP</h1><p>Serveur MCP connecté à l’API officielle Guild Wars 2.</p><p><a href="https://github.com/Jv1i3nn/gw2-mcp">Code source</a></p></main></body></html>`);
    return;
  }
  sendJson(response, 404, { error: "not_found" });
}
