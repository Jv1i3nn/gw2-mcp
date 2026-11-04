import { createServer, type Server } from "node:http";
import { pathToFileURL } from "node:url";
import handler from "../index.js";

function isLoopbackHost(host: string | undefined): boolean {
  if (!host) return false;
  const hostname = host.split(":")[0]?.toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

/** Starts a standalone Node.js HTTP server for self-hosted / non-Vercel deployments. */
export function startStandaloneServer(
  port = Number(process.env.PORT ?? 3000),
  host = process.env.HOST ?? "0.0.0.0",
): Promise<Server> {
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid PORT: ${String(port)}`);
  }

  const server = createServer((request, response) => {
    if (!request.headers["x-forwarded-proto"] && isLoopbackHost(request.headers.host)) {
      request.headers["x-forwarded-proto"] = "http";
    }
    void handler(request, response).catch(() => {
      if (!response.headersSent) {
        response.statusCode = 500;
        response.setHeader("Content-Type", "application/json; charset=utf-8");
      }
      response.end(JSON.stringify({ error: "internal_server_error" }));
    });
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.removeListener("error", reject);
      resolve(server);
    });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = await startStandaloneServer();
  const address = server.address();
  const bound = typeof address === "object" && address ? `${address.address}:${address.port}` : String(address);
  console.log(`Guild Wars 2 MCP server listening on http://${bound}`);

  const shutdown = () => {
    server.close(() => process.exit(0));
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
