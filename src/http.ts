import type { IncomingMessage, ServerResponse } from "node:http";

export type VercelRequest = IncomingMessage & {
  body?: unknown;
  auth?: { token: string; clientId: string; scopes: string[] };
};

const MAX_BODY_BYTES = 64 * 1024;
const VALID_HOST = /^(?:[A-Za-z0-9.-]+|\[[0-9a-fA-F:]+\])(?::\d{1,5})?$/;

export function requestOrigin(request: IncomingMessage): string {
  const forwardedProto = (firstHeader(request.headers["x-forwarded-proto"]) ?? "https").toLowerCase();
  if (forwardedProto !== "http" && forwardedProto !== "https") {
    throw new Error("Invalid request protocol");
  }
  const forwardedHost = firstHeader(request.headers["x-forwarded-host"]) ?? request.headers.host;
  if (!forwardedHost || !VALID_HOST.test(forwardedHost)) {
    throw new Error("Invalid or missing request host");
  }
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

  return new URLSearchParams(await readRawBody(request));
}

export async function readJson(request: VercelRequest): Promise<Record<string, unknown>> {
  if (request.body && typeof request.body === "object" && !Buffer.isBuffer(request.body)) {
    return request.body as Record<string, unknown>;
  }
  const raw = typeof request.body === "string"
    ? request.body
    : Buffer.isBuffer(request.body)
      ? request.body.toString("utf8")
      : await readRawBody(request);
  const parsed: unknown = JSON.parse(raw || "{}");
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Expected a JSON object");
  }
  return parsed as Record<string, unknown>;
}

async function readRawBody(request: VercelRequest): Promise<string> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > MAX_BODY_BYTES) {
      throw new Error("Request body too large");
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
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
