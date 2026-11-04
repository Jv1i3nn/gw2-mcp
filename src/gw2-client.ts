import type { ApiKeyProvider } from "./auth.js";

export type QueryValue = string | number | boolean | Array<string | number>;

export interface Gw2Request {
  endpoint: string;
  query?: Record<string, QueryValue>;
  authenticated?: boolean;
}

export class Gw2ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
  }
}

export class Gw2Client {
  constructor(
    private readonly apiKey: ApiKeyProvider,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async get({ endpoint, query = {}, authenticated = false }: Gw2Request): Promise<unknown> {
    const path = normalizeEndpoint(endpoint);
    const url = new URL(`https://api.guildwars2.com/${path}`);

    for (const [name, rawValue] of Object.entries(query)) {
      const value = Array.isArray(rawValue) ? rawValue.join(",") : String(rawValue);
      url.searchParams.set(name, value);
    }

    const key = await this.apiKey();
    if (authenticated && !key) {
      throw new Error(
        "This request requires a Guild Wars 2 API key. Authenticate through the MCP OAuth flow.",
      );
    }

    const response = await this.fetcher(url, {
      headers: key ? { Authorization: `Bearer ${key}` } : undefined,
      signal: AbortSignal.timeout(30_000),
    });
    const text = await response.text();
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }

    if (!response.ok) {
      throw new Gw2ApiError(`Guild Wars 2 API returned HTTP ${response.status}`, response.status, body);
    }
    return body;
  }
}

export function normalizeEndpoint(endpoint: string): string {
  const path = endpoint.trim().replace(/^\/+/, "");
  if (!/^v[12](?:\/|$)/.test(path)) {
    throw new Error("endpoint must start with v2/ (or legacy v1/)");
  }
  if (path.includes("?") || path.includes("#") || path.includes("\\") || path.split("/").includes("..")) {
    throw new Error("Put query parameters in the query object; endpoint contains an invalid segment");
  }
  return path;
}
