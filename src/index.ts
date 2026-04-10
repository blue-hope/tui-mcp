#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createRequire } from "node:module";
import { readdirSync, existsSync, chmodSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SessionManager } from "./session-manager.js";
import { registerTools } from "./tools.js";

const require = createRequire(import.meta.url);

// Fix node-pty spawn-helper permissions (prebuild ships without +x)
try {
  const ptyEntry = require.resolve("node-pty");
  const ptyDir = join(dirname(ptyEntry), "..", "prebuilds");
  if (existsSync(ptyDir)) {
    for (const dir of readdirSync(ptyDir)) {
      const helper = join(ptyDir, dir, "spawn-helper");
      if (existsSync(helper)) chmodSync(helper, 0o755);
    }
  }
} catch {
  // ignore — best effort
}
const pkg = require("../package.json") as { name: string; version: string };

const server = new McpServer({
  name: pkg.name,
  version: pkg.version,
});

const sessionManager = new SessionManager();
sessionManager.startIdleChecker();

registerTools(server, sessionManager);

const transport = new StdioServerTransport();
await server.connect(transport);

process.stderr.write(
  `[tui-mcp] Server started (${pkg.name} v${pkg.version})\n`,
);

const shutdown = async () => {
  process.stderr.write("[tui-mcp] Shutting down...\n");
  sessionManager.shutdownAll();
  await server.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
