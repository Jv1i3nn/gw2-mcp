import type { ServerResponse } from "node:http";
import { readForm, redirect, requestOrigin, requestUrl, sendHtml, sendJson, type VercelRequest } from "./http.js";
import { openToken, sealToken, verifyPkce, type AuthorizationCodePayload } from "./oauth-token.js";

const SCOPE = "gw2:read";
const CODE_LIFETIME_MS = 5 * 60_000;
const ACCESS_TOKEN_LIFETIME_MS = 7 * 24 * 60 * 60_000;

export function protectedResourceMetadata(origin: string) {
  return {
    resource: `${origin}/mcp`,
    authorization_servers: [origin],
    scopes_supported: [SCOPE],
    bearer_methods_supported: ["header"],
    resource_documentation: `${origin}/`,
  };
}

export function authorizationServerMetadata(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/oauth/token`,
    client_id_metadata_document_supported: true,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: [SCOPE],
    authorization_response_iss_parameter_supported: true,
  };
}

export async function handleAuthorize(request: VercelRequest, response: ServerResponse): Promise<void> {
  const parameters = request.method === "POST" ? await readForm(request) : requestUrl(request).searchParams;
  const origin = requestOrigin(request);

  try {
    const oauth = validateAuthorizationRequest(parameters, origin);
    if (request.method === "GET") {
      sendHtml(response, 200, authorizationPage(oauth));
      return;
    }
    if (request.method !== "POST") {
      sendJson(response, 405, { error: "method_not_allowed" }, { Allow: "GET, POST" });
      return;
    }

    const gw2Key = parameters.get("gw2_key")?.trim();
    if (!gw2Key) throw new OAuthError("invalid_request", "La clé API Guild Wars 2 est obligatoire.");
    await validateGw2Key(gw2Key);

    const code = sealToken({
      type: "authorization_code",
      gw2Key,
      clientId: oauth.clientId,
      redirectUri: oauth.redirectUri,
      codeChallenge: oauth.codeChallenge,
      resource: oauth.resource,
      scope: oauth.scope,
      expiresAt: Date.now() + CODE_LIFETIME_MS,
    });
    const destination = new URL(oauth.redirectUri);
    destination.searchParams.set("code", code);
    destination.searchParams.set("state", oauth.state);
    destination.searchParams.set("iss", origin);
    redirect(response, destination.toString());
  } catch (error) {
    const oauthError = error instanceof OAuthError ? error : new OAuthError("server_error", "Erreur interne d’autorisation.");
    sendHtml(response, oauthError.status, errorPage(oauthError.description));
  }
}

export async function handleToken(request: VercelRequest, response: ServerResponse): Promise<void> {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "method_not_allowed" }, { Allow: "POST" });
    return;
  }

  try {
    const form = await readForm(request);
    if (form.get("grant_type") !== "authorization_code") throw new OAuthError("unsupported_grant_type", "Unsupported grant type");
    const rawCode = required(form, "code");
    const verifier = required(form, "code_verifier");
    const clientId = required(form, "client_id");
    const redirectUri = required(form, "redirect_uri");
    const resource = required(form, "resource");
    const payload = openToken(rawCode);
    if (payload.type !== "authorization_code") throw new OAuthError("invalid_grant", "Invalid authorization code");
    validateCodeExchange(payload, { clientId, redirectUri, resource, verifier });

    const now = Date.now();
    const accessToken = sealToken({
      type: "access_token",
      gw2Key: payload.gw2Key,
      audience: payload.resource,
      scope: payload.scope,
      issuedAt: now,
      expiresAt: now + ACCESS_TOKEN_LIFETIME_MS,
    });
    sendJson(response, 200, {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: Math.floor(ACCESS_TOKEN_LIFETIME_MS / 1000),
      scope: payload.scope,
    });
  } catch (error) {
    const oauthError = error instanceof OAuthError ? error : new OAuthError("invalid_grant", "Invalid or expired authorization code");
    sendJson(response, oauthError.status, { error: oauthError.code, error_description: oauthError.description });
  }
}

export function resolveAccessToken(rawToken: string, expectedAudience: string): string {
  const payload = openToken(rawToken);
  if (payload.type !== "access_token" || payload.audience !== expectedAudience || !payload.scope.split(" ").includes(SCOPE)) {
    throw new Error("Invalid access token");
  }
  return payload.gw2Key;
}

function validateAuthorizationRequest(parameters: URLSearchParams, origin: string) {
  if (parameters.get("response_type") !== "code") throw new OAuthError("unsupported_response_type", "Seul le flux Authorization Code est accepté.");
  const clientId = required(parameters, "client_id");
  const redirectUri = required(parameters, "redirect_uri");
  const codeChallenge = required(parameters, "code_challenge");
  const state = required(parameters, "state");
  const resource = required(parameters, "resource");
  if (parameters.get("code_challenge_method") !== "S256") throw new OAuthError("invalid_request", "PKCE S256 est obligatoire.");
  if (!/^[A-Za-z0-9_-]{43}$/.test(codeChallenge)) throw new OAuthError("invalid_request", "Code challenge PKCE invalide.");
  if (!isChatGptClient(clientId)) throw new OAuthError("unauthorized_client", "Client OAuth non autorisé.", 403);
  if (!isChatGptRedirect(redirectUri)) throw new OAuthError("invalid_request", "URI de redirection non autorisée.", 403);
  if (resource !== `${origin}/mcp`) throw new OAuthError("invalid_target", "Ressource MCP invalide.");
  const requestedScope = parameters.get("scope")?.trim() || SCOPE;
  if (requestedScope !== SCOPE) throw new OAuthError("invalid_scope", `Seule la portée ${SCOPE} est acceptée.`);
  return { clientId, redirectUri, codeChallenge, state, resource, scope: SCOPE };
}

function validateCodeExchange(
  payload: AuthorizationCodePayload,
  input: { clientId: string; redirectUri: string; resource: string; verifier: string },
): void {
  if (payload.clientId !== input.clientId || payload.redirectUri !== input.redirectUri || payload.resource !== input.resource) {
    throw new OAuthError("invalid_grant", "Authorization code context mismatch");
  }
  if (!verifyPkce(input.verifier, payload.codeChallenge)) throw new OAuthError("invalid_grant", "PKCE verification failed");
}

async function validateGw2Key(key: string): Promise<void> {
  const response = await fetch("https://api.guildwars2.com/v2/tokeninfo", {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new OAuthError("access_denied", "Cette clé API Guild Wars 2 est invalide ou inaccessible.", 401);
}

function isChatGptClient(clientId: string): boolean {
  try {
    const url = new URL(clientId);
    return url.protocol === "https:" && url.hostname === "chatgpt.com" && /^\/oauth\/(?:client\.json|[^/]+\/client\.json)$/.test(url.pathname);
  } catch {
    return false;
  }
}

function isChatGptRedirect(redirectUri: string): boolean {
  try {
    const url = new URL(redirectUri);
    return url.protocol === "https:" && url.hostname === "chatgpt.com" &&
      (url.pathname === "/connector_platform_oauth_redirect" || /^\/connector\/oauth\/[^/]+$/.test(url.pathname));
  } catch {
    return false;
  }
}

function required(parameters: URLSearchParams, name: string): string {
  const value = parameters.get(name)?.trim();
  if (!value) throw new OAuthError("invalid_request", `Missing ${name}`);
  return value;
}

function authorizationPage(oauth: ReturnType<typeof validateAuthorizationRequest>): string {
  const hidden = Object.entries({
    response_type: "code", client_id: oauth.clientId, redirect_uri: oauth.redirectUri,
    code_challenge: oauth.codeChallenge, code_challenge_method: "S256", state: oauth.state,
    resource: oauth.resource, scope: oauth.scope,
  }).map(([name, value]) => `<input type="hidden" name="${name}" value="${escapeHtml(value)}">`).join("\n");
  return page("Connecter Guild Wars 2", `<h1>Connecter Guild Wars 2</h1><p>Collez une clé API créée sur votre compte ArenaNet. Elle sera chiffrée dans un jeton temporaire et ne sera pas enregistrée sur le serveur.</p><form method="post" action="/oauth/authorize">${hidden}<label for="gw2_key">Clé API Guild Wars 2</label><input id="gw2_key" name="gw2_key" type="password" required autocomplete="off" spellcheck="false"><button type="submit">Connecter à ChatGPT</button></form><p class="small">La clé est validée directement auprès de l’API officielle Guild Wars 2.</p>`);
}

function errorPage(message: string): string {
  return page("Autorisation impossible", `<h1>Autorisation impossible</h1><p class="error">${escapeHtml(message)}</p><p>Vous pouvez fermer cette fenêtre et recommencer la connexion depuis ChatGPT.</p>`);
}

function page(title: string, content: string): string {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>:root{font-family:system-ui,sans-serif;color-scheme:light dark}body{max-width:34rem;margin:10vh auto;padding:1.5rem;line-height:1.5}form{display:grid;gap:1rem}input,button{font:inherit;padding:.8rem;border-radius:.5rem;border:1px solid #888}button{cursor:pointer;font-weight:650}.small{font-size:.875rem;opacity:.7}.error{color:#c33}</style></head><body>${content}</body></html>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

class OAuthError extends Error {
  constructor(readonly code: string, readonly description: string, readonly status = 400) {
    super(description);
  }
}
