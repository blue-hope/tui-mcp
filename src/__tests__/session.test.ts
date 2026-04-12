import { describe, it, expect, afterEach } from "vitest";
import { Session } from "../session.js";
import { describePty } from "./pty-available.js";

const sessions: Session[] = [];

function createSession(
  opts: Partial<ConstructorParameters<typeof Session>[0]> = {},
): Session {
  const session = new Session({
    sessionId: `test-${Date.now()}`,
    command: opts.command ?? "echo",
    args: opts.args ?? ["hello"],
    ...opts,
  });
  sessions.push(session);
  return session;
}

afterEach(() => {
  for (const s of sessions) {
    try {
      s.dispose();
    } catch {
      // ignore
    }
  }
  sessions.length = 0;
});

describePty("Session", () => {
  it("creates a session and reads screen text containing output", async () => {
    const session = createSession({ command: "echo", args: ["hello"] });

    await new Promise<void>((resolve) => {
      session.onExit(() => setTimeout(resolve, 200));
    });

    const lines = session.getScreenText();
    const text = lines.join("\n");
    expect(text).toContain("hello");
  });

  it("transitions to exited status after process ends", async () => {
    const session = createSession({ command: "echo", args: ["done"] });
    expect(session.status).toBe("running");

    await new Promise<void>((resolve) => session.onExit(resolve));

    expect(session.status).toBe("exited");
    expect(session.exitCode).toBeDefined();
  });

  it("returns valid cursor position", async () => {
    const session = createSession({ command: "sh", args: ["-c", "echo hi"] });
    await new Promise((r) => setTimeout(r, 300));

    const cursor = session.getCursorPosition();
    expect(cursor.x).toBeGreaterThanOrEqual(0);
    expect(cursor.y).toBeGreaterThanOrEqual(0);
  });

  it("resizes both PTY and Terminal", async () => {
    const session = createSession({
      command: "sh",
      args: ["-c", "sleep 2"],
      cols: 80,
      rows: 24,
    });

    session.resize(120, 40);
    const size = session.getScreenSize();
    expect(size.cols).toBe(120);
    expect(size.rows).toBe(40);
  });

  it("writes input to shell and sees echo", async () => {
    const session = createSession({
      command: "sh",
      args: [],
      cols: 80,
      rows: 24,
    });
    await new Promise((r) => setTimeout(r, 300));

    session.writeInput("echo test_marker\r");
    await new Promise((r) => setTimeout(r, 500));

    const lines = session.getScreenText();
    const text = lines.join("\n");
    expect(text).toContain("test_marker");
  });

  it("detects session exit", async () => {
    const session = createSession({
      command: "sh",
      args: ["-c", "exit 42"],
    });

    await new Promise<void>((resolve) => session.onExit(resolve));

    expect(session.status).toBe("exited");
    expect(session.exitCode).toBe(42);
  });

  it("serializes concurrent operations with mutex", async () => {
    const session = createSession({
      command: "sh",
      args: ["-c", "sleep 5"],
    });
    await new Promise((r) => setTimeout(r, 200));

    const order: number[] = [];
    const task = async (id: number) => {
      const release = await session.mutex.acquire();
      order.push(id);
      await new Promise((r) => setTimeout(r, 30));
      release();
    };

    await Promise.all([task(1), task(2), task(3)]);
    expect(order).toEqual([1, 2, 3]);
  });

  it("sets TERM=xterm-256color in PTY environment", async () => {
    const session = createSession({
      command: "sh",
      args: ["-c", "echo $TERM"],
    });

    await new Promise<void>((resolve) => {
      session.onExit(() => setTimeout(resolve, 200));
    });

    const lines = session.getScreenText();
    const text = lines.join("\n");
    expect(text).toContain("xterm-256color");
  });

  it("launches within reasonable time", async () => {
    const start = Date.now();
    const session = createSession({ command: "echo", args: ["fast"] });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(3000);

    await new Promise<void>((resolve) => session.onExit(resolve));
  });

  it("handles non-existent command gracefully", async () => {
    // node-pty spawns via shell, so the PTY itself succeeds but the
    // process exits quickly with a non-zero exit code
    const session = createSession({
      command: "/nonexistent/command/xyz",
      args: [],
    });
    await new Promise<void>((resolve) => session.onExit(resolve));
    expect(session.status).toBe("exited");
    expect(session.exitCode).not.toBe(0);
  });
});
