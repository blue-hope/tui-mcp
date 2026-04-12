import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SessionManager } from "./session-manager.js";
import { resolveKey } from "./keys.js";
import { wrapHandler, jsonResponse, errorResponse } from "./tool-wrapper.js";

export function registerTools(
  server: McpServer,
  sessionManager: SessionManager,
): void {
  // --- Session Management ---

  server.registerTool(
    "launch",
    {
      description:
        "Launch a TUI application in a new PTY session. Returns the session ID for subsequent interactions.",
      inputSchema: {
        command: z.string().describe("Command to execute"),
        args: z
          .array(z.string())
          .optional()
          .describe(
            "Arguments array. If omitted, command is executed via shell.",
          ),
        cwd: z.string().optional().describe("Working directory"),
        env: z
          .record(z.string())
          .optional()
          .describe("Additional environment variables"),
        cols: z
          .number()
          .min(1)
          .max(500)
          .default(80)
          .describe("Terminal columns"),
        rows: z
          .number()
          .min(1)
          .max(500)
          .default(24)
          .describe("Terminal rows"),
      },
      annotations: { destructiveHint: true },
    },
    wrapHandler(
      "launch",
      async (args: {
        command: string;
        args?: string[];
        cwd?: string;
        env?: Record<string, string>;
        cols: number;
        rows: number;
      }) => {
        const result = await sessionManager.createSession({
          command: args.command,
          args: args.args,
          cwd: args.cwd,
          env: args.env,
          cols: args.cols,
          rows: args.rows,
        });
        return jsonResponse(result);
      },
    ),
  );

  server.registerTool(
    "list_sessions",
    {
      description: "List all active TUI sessions with their metadata.",
      annotations: { readOnlyHint: true },
    },
    wrapHandler("list_sessions", async () => {
      return jsonResponse(sessionManager.listSessions());
    }),
  );

  server.registerTool(
    "kill_session",
    {
      description: "Terminate a TUI session and its PTY process.",
      inputSchema: {
        sessionId: z.string().describe("Session ID to kill"),
      },
      annotations: { destructiveHint: true },
    },
    wrapHandler("kill_session", async (args: { sessionId: string }) => {
      await sessionManager.killSession(args.sessionId);
      return jsonResponse({ success: true });
    }),
  );

  // --- Observation ---

  server.registerTool(
    "take_snapshot",
    {
      description:
        "Capture the current terminal screen content, cursor position, and dimensions.",
      inputSchema: {
        sessionId: z.string().describe("Session ID"),
      },
      annotations: { readOnlyHint: true },
    },
    wrapHandler("take_snapshot", async (args: { sessionId: string }) => {
      const session = sessionManager.getSession(args.sessionId);
      const release = await session.mutex.acquire();
      try {
        const lines = session.getScreenText();
        const cursor = session.getCursorPosition();
        const size = session.getScreenSize();
        return jsonResponse({
          sessionId: session.sessionId,
          lines,
          cursor,
          rows: size.rows,
          cols: size.cols,
          title: session.command,
        });
      } finally {
        release();
      }
    }),
  );

  server.registerTool(
    "get_cursor_position",
    {
      description: "Get the current cursor position in the terminal.",
      inputSchema: {
        sessionId: z.string().describe("Session ID"),
      },
      annotations: { readOnlyHint: true },
    },
    wrapHandler("get_cursor_position", async (args: { sessionId: string }) => {
      const session = sessionManager.getSession(args.sessionId);
      return jsonResponse(session.getCursorPosition());
    }),
  );

  server.registerTool(
    "get_screen_size",
    {
      description: "Get the terminal dimensions (columns and rows).",
      inputSchema: {
        sessionId: z.string().describe("Session ID"),
      },
      annotations: { readOnlyHint: true },
    },
    wrapHandler("get_screen_size", async (args: { sessionId: string }) => {
      const session = sessionManager.getSession(args.sessionId);
      return jsonResponse(session.getScreenSize());
    }),
  );

  // --- Input ---

  server.registerTool(
    "type_text",
    {
      description: "Send text input to the TUI application.",
      inputSchema: {
        sessionId: z.string().describe("Session ID"),
        text: z.string().describe("Text to type"),
      },
      annotations: { destructiveHint: true },
    },
    wrapHandler(
      "type_text",
      async (args: { sessionId: string; text: string }) => {
        const session = sessionManager.getSession(args.sessionId);
        const release = await session.mutex.acquire();
        try {
          session.writeInput(args.text);
          return jsonResponse({ success: true });
        } finally {
          release();
        }
      },
    ),
  );

  server.registerTool(
    "press_key",
    {
      description:
        'Send a key press to the TUI application. Supports named keys (Enter, Tab, Escape, ArrowUp, F1-F12, etc.) and modifier combinations (Ctrl+C, Alt+X, Shift+F5).',
      inputSchema: {
        sessionId: z.string().describe("Session ID"),
        key: z
          .string()
          .describe(
            'Key name or combination (e.g., "Enter", "Ctrl+C", "Alt+X", "F5")',
          ),
      },
      annotations: { destructiveHint: true },
    },
    wrapHandler(
      "press_key",
      async (args: { sessionId: string; key: string }) => {
        const session = sessionManager.getSession(args.sessionId);
        let sequence: string;
        try {
          sequence = resolveKey(args.key);
        } catch {
          return errorResponse(`Unknown key: ${args.key}`);
        }
        const release = await session.mutex.acquire();
        try {
          session.writeInput(sequence);
          return jsonResponse({ success: true, key: args.key });
        } finally {
          release();
        }
      },
    ),
  );

  // --- Control ---

  server.registerTool(
    "resize",
    {
      description: "Resize the terminal dimensions.",
      inputSchema: {
        sessionId: z.string().describe("Session ID"),
        cols: z.number().min(1).max(500).describe("New column count"),
        rows: z.number().min(1).max(500).describe("New row count"),
      },
      annotations: { destructiveHint: true },
    },
    wrapHandler(
      "resize",
      async (args: { sessionId: string; cols: number; rows: number }) => {
        const session = sessionManager.getSession(args.sessionId);
        const release = await session.mutex.acquire();
        try {
          session.resize(args.cols, args.rows);
          return jsonResponse({ cols: args.cols, rows: args.rows });
        } finally {
          release();
        }
      },
    ),
  );

  server.registerTool(
    "wait_for_text",
    {
      description:
        "Wait until specific text appears on the terminal screen. Polls every 50ms.",
      inputSchema: {
        sessionId: z.string().describe("Session ID"),
        text: z.string().describe("Text to search for (substring match)"),
        timeout: z
          .number()
          .min(1000)
          .max(60000)
          .default(10000)
          .describe("Timeout in milliseconds (1000-60000, default 10000)"),
      },
      annotations: { readOnlyHint: true },
    },
    wrapHandler(
      "wait_for_text",
      async (args: { sessionId: string; text: string; timeout: number }) => {
        const session = sessionManager.getSession(args.sessionId);
        const deadline = Date.now() + args.timeout;

        return new Promise<ReturnType<typeof jsonResponse>>((resolve) => {
          let settled = false;

          const onSessionExit = () => {
            if (!settled) {
              settled = true;
              resolve(
                errorResponse(
                  `Session ${args.sessionId} exited while waiting for text`,
                ),
              );
            }
          };
          session.onExit(onSessionExit);

          const poll = () => {
            if (settled) return;

            const lines = session.getScreenText();
            const screenText = lines.join("\n");
            if (screenText.includes(args.text)) {
              settled = true;
              const cursor = session.getCursorPosition();
              const size = session.getScreenSize();
              resolve(
                jsonResponse({
                  sessionId: session.sessionId,
                  found: true,
                  lines,
                  cursor,
                  rows: size.rows,
                  cols: size.cols,
                }),
              );
              return;
            }

            if (Date.now() >= deadline) {
              settled = true;
              resolve(
                errorResponse(
                  `Timeout waiting for text "${args.text}" after ${args.timeout}ms`,
                ),
              );
              return;
            }

            setTimeout(poll, 50);
          };

          poll();
        });
      },
    ),
  );

  server.registerTool(
    "wait_for_stable",
    {
      description:
        "Wait until the visible terminal screen content stops changing. Compares actual screen text (not raw PTY data), so cursor blink and other invisible updates are ignored. Default stability window is 500ms.",
      inputSchema: {
        sessionId: z.string().describe("Session ID"),
        stableMs: z
          .number()
          .min(100)
          .max(5000)
          .default(500)
          .describe(
            "How long the screen must remain unchanged to be considered stable (100-5000ms, default 500)",
          ),
        timeout: z
          .number()
          .min(1000)
          .max(60000)
          .default(10000)
          .describe("Timeout in milliseconds (1000-60000, default 10000)"),
      },
      annotations: { readOnlyHint: true },
    },
    wrapHandler(
      "wait_for_stable",
      async (args: {
        sessionId: string;
        stableMs: number;
        timeout: number;
      }) => {
        const session = sessionManager.getSession(args.sessionId);
        const deadline = Date.now() + args.timeout;
        const stableThreshold = args.stableMs;

        return new Promise<ReturnType<typeof jsonResponse>>((resolve) => {
          let settled = false;
          let lastScreenText = session.getScreenText().join("\n");
          let stableSince = Date.now();

          const onSessionExit = () => {
            if (!settled) {
              settled = true;
              resolve(
                errorResponse(
                  `Session ${args.sessionId} exited while waiting for stable`,
                ),
              );
            }
          };
          session.onExit(onSessionExit);

          const check = () => {
            if (settled) return;

            const currentText = session.getScreenText().join("\n");
            if (currentText !== lastScreenText) {
              lastScreenText = currentText;
              stableSince = Date.now();
            }

            if (Date.now() - stableSince >= stableThreshold) {
              settled = true;
              const lines = session.getScreenText();
              const cursor = session.getCursorPosition();
              const size = session.getScreenSize();
              resolve(
                jsonResponse({
                  sessionId: session.sessionId,
                  stable: true,
                  lines,
                  cursor,
                  rows: size.rows,
                  cols: size.cols,
                }),
              );
              return;
            }

            if (Date.now() >= deadline) {
              settled = true;
              resolve(
                errorResponse(
                  `Timeout waiting for stable screen after ${args.timeout}ms`,
                ),
              );
              return;
            }

            setTimeout(check, 50);
          };

          check();
        });
      },
    ),
  );

  // --- Search ---

  server.registerTool(
    "find_text",
    {
      description:
        "Find text on the terminal screen and return its position (row, column). Searches visible screen line by line.",
      inputSchema: {
        sessionId: z.string().describe("Session ID"),
        text: z.string().describe("Text to search for (substring match)"),
        nth: z
          .number()
          .min(1)
          .default(1)
          .describe("Return the Nth occurrence (default 1)"),
      },
      annotations: { readOnlyHint: true },
    },
    wrapHandler(
      "find_text",
      async (args: { sessionId: string; text: string; nth: number }) => {
        const session = sessionManager.getSession(args.sessionId);
        const lines = session.getScreenText();
        let count = 0;

        for (let row = 0; row < lines.length; row++) {
          let startCol = 0;
          while (true) {
            const col = lines[row].indexOf(args.text, startCol);
            if (col === -1) break;
            count++;
            if (count === args.nth) {
              return jsonResponse({
                found: true,
                row,
                col,
                context: lines[row].trimEnd(),
              });
            }
            startCol = col + 1;
          }
        }

        return jsonResponse({ found: false, occurrences: count });
      },
    ),
  );

  // --- Signals ---

  const ALLOWED_SIGNALS = [
    "SIGINT",
    "SIGTERM",
    "SIGTSTP",
    "SIGCONT",
    "SIGUSR1",
    "SIGUSR2",
    "SIGHUP",
    "SIGQUIT",
  ];

  server.registerTool(
    "send_signal",
    {
      description:
        "Send a POSIX signal to the session's PTY process. Supports SIGINT, SIGTERM, SIGTSTP, SIGCONT, SIGUSR1, SIGUSR2, SIGHUP, SIGQUIT.",
      inputSchema: {
        sessionId: z.string().describe("Session ID"),
        signal: z
          .string()
          .describe(
            "Signal name (e.g., SIGINT, SIGTSTP, SIGCONT)",
          ),
      },
      annotations: { destructiveHint: true },
    },
    wrapHandler(
      "send_signal",
      async (args: { sessionId: string; signal: string }) => {
        const sig = args.signal.toUpperCase();
        if (!ALLOWED_SIGNALS.includes(sig)) {
          return errorResponse(
            `Unknown signal: ${args.signal}. Allowed: ${ALLOWED_SIGNALS.join(", ")}`,
          );
        }
        const session = sessionManager.getSession(args.sessionId);
        if (session.status !== "running") {
          return errorResponse(`Session ${args.sessionId} is not running`);
        }
        session.sendSignal(sig);
        return jsonResponse({ success: true, signal: sig });
      },
    ),
  );

  // --- Lifecycle ---

  server.registerTool(
    "wait_for_exit",
    {
      description:
        "Wait until the session's process exits and return the exit code. Useful for running commands and waiting for completion.",
      inputSchema: {
        sessionId: z.string().describe("Session ID"),
        timeout: z
          .number()
          .min(1000)
          .max(300000)
          .default(30000)
          .describe(
            "Timeout in milliseconds (1000-300000, default 30000)",
          ),
      },
      annotations: { readOnlyHint: true },
    },
    wrapHandler(
      "wait_for_exit",
      async (args: { sessionId: string; timeout: number }) => {
        const session = sessionManager.getSession(args.sessionId);

        if (session.status === "exited") {
          return jsonResponse({
            exited: true,
            exitCode: session.exitCode,
            signal: session.signal,
          });
        }

        return new Promise<ReturnType<typeof jsonResponse>>((resolve) => {
          let settled = false;

          const timer = setTimeout(() => {
            if (!settled) {
              settled = true;
              resolve(
                errorResponse(
                  `Timeout waiting for exit after ${args.timeout}ms`,
                ),
              );
            }
          }, args.timeout);

          session.onExit(() => {
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              resolve(
                jsonResponse({
                  exited: true,
                  exitCode: session.exitCode,
                  signal: session.signal,
                }),
              );
            }
          });
        });
      },
    ),
  );
}
