#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createRequire } from "node:module";
import { SessionManager } from "./session-manager.js";
import { registerTools } from "./tools.js";

const require = createRequire(import.meta.url);
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
