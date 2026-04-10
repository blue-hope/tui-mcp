import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SessionManager } from "../session-manager.js";
import { registerTools } from "../tools.js";
import { describePty } from "./pty-available.js";

let server: McpServer;
let sessionManager: SessionManager;
const createdSessions: string[] = [];

function parse(result: { content: Array<{ type: string; text: string }>; isError?: boolean }) {
  const text = result.content[0].text;
  return JSON.parse(text);
}

// Helper to call a tool directly through the server
async function callTool(name: string, args: Record<string, unknown> = {}) {
  // We'll test the handler logic directly through SessionManager + tools
  // since calling through MCP protocol requires a transport
  return null;
}

describePty("Tools Integration", () => {
  beforeAll(() => {
    server = new McpServer({ name: "test", version: "0.0.1" });
    sessionManager = new SessionManager();
    registerTools(server, sessionManager);
  });

  afterEach(async () => {
    for (const id of createdSessions) {
      try {
        await sessionManager.killSession(id);
      } catch {
        // already cleaned up
      }
    }
    createdSessions.length = 0;
  });

  afterAll(() => {
    sessionManager.shutdownAll();
  });

  describe("launch", () => {
    it("creates a session with default dimensions", async () => {
      const result = await sessionManager.createSession({
        command: "sh",
        args: ["-c", "sleep 5"],
      });
      createdSessions.push(result.sessionId);

      expect(result.sessionId).toHaveLength(8);
      expect(result.pid).toBeGreaterThan(0);
      expect(result.cols).toBe(80);
      expect(result.rows).toBe(24);
    });

    it("creates a session with custom dimensions", async () => {
      const result = await sessionManager.createSession({
        command: "sh",
        args: ["-c", "sleep 5"],
        cols: 120,
        rows: 40,
      });
      createdSessions.push(result.sessionId);

      expect(result.cols).toBe(120);
      expect(result.rows).toBe(40);
    });

    it("creates a session with cwd and env", async () => {
      const result = await sessionManager.createSession({
        command: "sh",
        args: ["-c", "echo $TEST_VAR"],
        cwd: "/tmp",
        env: { TEST_VAR: "hello_env" },
      });
      createdSessions.push(result.sessionId);

      await new Promise((r) => setTimeout(r, 500));
      const session = sessionManager.getSession(result.sessionId);
      const text = session.getScreenText().join("\n");
      expect(text).toContain("hello_env");
    });

    it("returns error for bad command", async () => {
      await expect(
        sessionManager.createSession({
          command: "/nonexistent/binary_xyz",
          args: [],
        }),
      ).rejects.toThrow();
    });
  });

  describe("list_sessions", () => {
    it("lists sessions after launch", async () => {
      const result = await sessionManager.createSession({
        command: "sh",
        args: ["-c", "sleep 5"],
      });
      createdSessions.push(result.sessionId);

      const sessions = sessionManager.listSessions();
      expect(sessions.length).toBeGreaterThan(0);
      expect(sessions.find((s) => s.sessionId === result.sessionId)).toBeDefined();
    });
  });

  describe("take_snapshot", () => {
    it("returns screen content with known text", async () => {
      const result = await sessionManager.createSession({
        command: "sh",
        args: ["-c", "echo snapshot_test_marker"],
      });
      createdSessions.push(result.sessionId);

      await new Promise((r) => setTimeout(r, 500));

      const session = sessionManager.getSession(result.sessionId);
      const lines = session.getScreenText();
      const text = lines.join("\n");
      expect(text).toContain("snapshot_test_marker");
    });

    it("returns valid cursor position", async () => {
      const result = await sessionManager.createSession({
        command: "sh",
        args: ["-c", "sleep 5"],
      });
      createdSessions.push(result.sessionId);
      await new Promise((r) => setTimeout(r, 300));

      const session = sessionManager.getSession(result.sessionId);
      const cursor = session.getCursorPosition();
      expect(cursor.x).toBeGreaterThanOrEqual(0);
      expect(cursor.y).toBeGreaterThanOrEqual(0);
    });
  });

  describe("get_cursor_position", () => {
    it("returns cursor coordinates", async () => {
      const result = await sessionManager.createSession({
        command: "sh",
        args: ["-c", "sleep 5"],
      });
      createdSessions.push(result.sessionId);
      await new Promise((r) => setTimeout(r, 300));

      const session = sessionManager.getSession(result.sessionId);
      const cursor = session.getCursorPosition();
      expect(typeof cursor.x).toBe("number");
      expect(typeof cursor.y).toBe("number");
    });
  });

  describe("get_screen_size", () => {
    it("returns dimensions matching launch params", async () => {
      const result = await sessionManager.createSession({
        command: "sh",
        args: ["-c", "sleep 5"],
        cols: 100,
        rows: 30,
      });
      createdSessions.push(result.sessionId);

      const session = sessionManager.getSession(result.sessionId);
      const size = session.getScreenSize();
      expect(size.cols).toBe(100);
      expect(size.rows).toBe(30);
    });
  });

  describe("type_text", () => {
    it("types text and sees echo in snapshot", async () => {
      const result = await sessionManager.createSession({
        command: "sh",
        args: [],
      });
      createdSessions.push(result.sessionId);
      await new Promise((r) => setTimeout(r, 300));

      const session = sessionManager.getSession(result.sessionId);
      session.writeInput("echo typed_text_marker\r");
      await new Promise((r) => setTimeout(r, 500));

      const text = session.getScreenText().join("\n");
      expect(text).toContain("typed_text_marker");
    });
  });

  describe("press_key", () => {
    it("sends Enter key", async () => {
      const { resolveKey } = await import("../keys.js");
      const seq = resolveKey("Enter");
      expect(seq).toBe("\r");
    });

    it("sends Ctrl+C", async () => {
      const { resolveKey } = await import("../keys.js");
      const seq = resolveKey("Ctrl+C");
      expect(seq).toBe("\x03");
    });

    it("returns error for unsupported key", async () => {
      const { resolveKey } = await import("../keys.js");
      expect(() => resolveKey("InvalidKeyXYZ")).toThrow();
    });
  });

  describe("wait_for_text", () => {
    it("detects text that appears after delay", async () => {
      const result = await sessionManager.createSession({
        command: "sh",
        args: ["-c", "sleep 0.3 && echo target_found_marker"],
      });
      createdSessions.push(result.sessionId);

      const session = sessionManager.getSession(result.sessionId);
      const deadline = Date.now() + 5000;

      // Poll manually
      let found = false;
      while (Date.now() < deadline) {
        const text = session.getScreenText().join("\n");
        if (text.includes("target_found_marker")) {
          found = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 50));
      }
      expect(found).toBe(true);
    });

    it("times out when text never appears", async () => {
      const result = await sessionManager.createSession({
        command: "sh",
        args: ["-c", "sleep 10"],
      });
      createdSessions.push(result.sessionId);

      const session = sessionManager.getSession(result.sessionId);
      const deadline = Date.now() + 1000;

      let found = false;
      while (Date.now() < deadline) {
        const text = session.getScreenText().join("\n");
        if (text.includes("never_gonna_appear")) {
          found = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 50));
      }
      expect(found).toBe(false);
    });
  });

  describe("wait_for_stable", () => {
    it("detects stable screen after output completes", async () => {
      const result = await sessionManager.createSession({
        command: "sh",
        args: ["-c", "echo stable_marker"],
      });
      createdSessions.push(result.sessionId);

      const session = sessionManager.getSession(result.sessionId);

      // Wait for stability
      let lastVersion = session.writeVersion;
      let stableSince = Date.now();
      const deadline = Date.now() + 5000;

      while (Date.now() < deadline) {
        if (session.writeVersion !== lastVersion) {
          lastVersion = session.writeVersion;
          stableSince = Date.now();
        }
        if (Date.now() - stableSince >= 200) {
          break;
        }
        await new Promise((r) => setTimeout(r, 50));
      }

      const text = session.getScreenText().join("\n");
      expect(text).toContain("stable_marker");
    });
  });

  describe("resize", () => {
    it("updates screen size", async () => {
      const result = await sessionManager.createSession({
        command: "sh",
        args: ["-c", "sleep 5"],
        cols: 80,
        rows: 24,
      });
      createdSessions.push(result.sessionId);

      const session = sessionManager.getSession(result.sessionId);
      session.resize(120, 40);

      const size = session.getScreenSize();
      expect(size.cols).toBe(120);
      expect(size.rows).toBe(40);
    });
  });

  describe("kill_session", () => {
    it("removes session from list", async () => {
      const result = await sessionManager.createSession({
        command: "sh",
        args: ["-c", "sleep 10"],
      });

      await sessionManager.killSession(result.sessionId);

      expect(() => sessionManager.getSession(result.sessionId)).toThrow(
        /Session not found/,
      );
    });
  });

});

describe("Tools (no PTY)", () => {
  it("returns error for invalid session ID", () => {
    const mgr = new SessionManager();
    expect(() => mgr.getSession("invalid_id")).toThrow(/Session not found/);
    mgr.shutdownAll();
  });

  it("resolveKey works for known keys", async () => {
    const { resolveKey } = await import("../keys.js");
    expect(resolveKey("Enter")).toBe("\r");
    expect(resolveKey("Ctrl+C")).toBe("\x03");
    expect(() => resolveKey("InvalidKeyXYZ")).toThrow();
  });
});
