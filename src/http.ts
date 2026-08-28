import type { IncomingMessage, ServerResponse } from "node:http";

export type VercelRequest = IncomingMessage & {
  body?: unknown;
  auth?: { token: string; clientId: string; scopes: string[] };
};

export function requestOrigin(request: IncomingMessage): string {
  const forwardedProto = firstHeader(request.headers["x-forwarded-proto"]) ?? "https";
  const forwardedHost = firstHeader(request.headers["x-forwarded-host"]) ?? request.headers.host;
  if (!forwardedHost) throw new Error("Missing request host");
  return `${forwardedProto}://${forwardedHost}`;
}

export function requestUrl(request: IncomingMessage): URL {
  return new URL(request.url ?? "/", requestOrigin(request));
}

export async function readForm(request: VercelRequest): Promise<URLSearchParams> {
  if (typeof request.body === "string") return new URLSearchParams(request.body);
  if (Buffer.isBuffer(request.body)) return new URLSearchParams(request.body.toString("utf8"));
  if (request.body && typeof request.body === "object") {
    return new URLSearchParams(Object.entries(request.body as Record<string, unknown>).map(([key, value]) => [key, String(value)]));
  }

  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
}

export function sendJson(response: ServerResponse, status: number, value: unknown, headers: Record<string, string> = {}): void {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  for (const [name, headerValue] of Object.entries(headers)) response.setHeader(name, headerValue);
  response.end(JSON.stringify(value));
}

export function sendHtml(response: ServerResponse, status: number, html: string): void {
  response.statusCode = status;
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
  response.end(html);
}

export function redirect(response: ServerResponse, location: string): void {
  response.statusCode = 302;
  response.setHeader("Location", location);
  response.setHeader("Cache-Control", "no-store");
  response.end();
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value?.split(",")[0]?.trim();
}
