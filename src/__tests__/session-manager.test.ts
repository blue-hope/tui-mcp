import { describe, it, expect, afterEach } from "vitest";
import { SessionManager } from "../session-manager.js";
import { describePty } from "./pty-available.js";

let manager: SessionManager;

afterEach(() => {
  if (manager) {
    manager.shutdownAll();
  }
});

describePty("SessionManager", () => {
  it("creates and lists sessions", async () => {
    manager = new SessionManager();
    const result = await manager.createSession({
      command: "sh",
      args: ["-c", "sleep 5"],
    });

    expect(result.sessionId).toBeTruthy();
    expect(result.pid).toBeGreaterThan(0);
    expect(result.cols).toBe(80);
    expect(result.rows).toBe(24);

    const sessions = manager.listSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].sessionId).toBe(result.sessionId);
    expect(sessions[0].command).toBe("sh");
    expect(sessions[0].status).toBe("running");
  });

  it("kills session and removes from list", async () => {
    manager = new SessionManager();
    const result = await manager.createSession({
      command: "sh",
      args: ["-c", "sleep 10"],
    });

    await manager.killSession(result.sessionId);

    const sessions = manager.listSessions();
    expect(sessions).toHaveLength(0);
  });

  it("enforces max sessions limit", async () => {
    manager = new SessionManager();
    for (let i = 0; i < 10; i++) {
      await manager.createSession({
        command: "sh",
        args: ["-c", "sleep 10"],
      });
    }

    await expect(
      manager.createSession({ command: "sh", args: ["-c", "sleep 10"] }),
    ).rejects.toThrow(/Maximum sessions/);
  });

  it("isolates sessions - killing one doesn't affect others", async () => {
    manager = new SessionManager();
    const s1 = await manager.createSession({
      command: "sh",
      args: ["-c", "sleep 10"],
    });
    const s2 = await manager.createSession({
      command: "sh",
      args: ["-c", "sleep 10"],
    });

    await manager.killSession(s1.sessionId);

    const sessions = manager.listSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].sessionId).toBe(s2.sessionId);
  });

  it("shuts down all sessions", async () => {
    manager = new SessionManager();
    await manager.createSession({
      command: "sh",
      args: ["-c", "sleep 10"],
    });
    await manager.createSession({
      command: "sh",
      args: ["-c", "sleep 10"],
    });

    manager.shutdownAll();

    expect(manager.sessionCount).toBe(0);
  });

  it("auto-cleans up after process exit", async () => {
    manager = new SessionManager();
    const result = await manager.createSession({
      command: "sh",
      args: ["-c", "exit 0"],
    });

    // Wait for process to exit
    await new Promise((r) => setTimeout(r, 500));

    const session = manager.getSession(result.sessionId);
    expect(session.status).toBe("exited");
  });

});

describe("SessionManager (no PTY)", () => {
  it("throws for non-existent session ID", () => {
    manager = new SessionManager();
    expect(() => manager.getSession("nonexistent")).toThrow(
      /Session not found/,
    );
  });
});
