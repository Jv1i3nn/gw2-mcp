export type ApiKeyProvider = () => Promise<string | undefined>;

/** Resolves the per-user GW2 key established by the MCP authentication layer. */
export function createApiKeyProvider(authenticatedKey: () => string | undefined): ApiKeyProvider {
  return async () => authenticatedKey()?.trim() || undefined;
}
