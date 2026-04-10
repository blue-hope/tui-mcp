import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyToolHandler = (args: any) => Promise<ToolResult>;

export function wrapHandler(
  name: string,
  handler: AnyToolHandler,
): AnyToolHandler {
  return async (args) => {
    const start = Date.now();
    process.stderr.write(`[tui-mcp] ${name} started\n`);
    try {
      const result = await handler(args);
      const elapsed = Date.now() - start;
      process.stderr.write(`[tui-mcp] ${name} completed in ${elapsed}ms\n`);
      return result;
    } catch (error) {
      const elapsed = Date.now() - start;
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(
        `[tui-mcp] ${name} failed in ${elapsed}ms: ${message}\n`,
      );
      return {
        content: [
          { type: "text" as const, text: JSON.stringify({ error: message }) },
        ],
        isError: true,
      };
    }
  };
}

export function jsonResponse(data: unknown): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data) }],
  };
}

export function errorResponse(message: string): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}
