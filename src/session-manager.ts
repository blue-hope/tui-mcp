import { nanoid } from "nanoid";
import { Session, type SessionOptions } from "./session.js";
import { Mutex } from "./mutex.js";

const MAX_SESSIONS = 10;
const DEFAULT_IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const EXIT_CLEANUP_DELAY_MS = 5 * 60 * 1000; // 5 minutes
const IDLE_CHECK_INTERVAL_MS = 60 * 1000; // 60 seconds

export class SessionManager {
  private sessions = new Map<string, Session>();
  private managerMutex = new Mutex();
  private idleCheckInterval: ReturnType<typeof setInterval> | undefined;
  private idleTimeoutMs: number;

  constructor() {
    const envTimeout = process.env.TUI_MCP_IDLE_TIMEOUT;
    this.idleTimeoutMs = envTimeout
      ? parseInt(envTimeout, 10)
      : DEFAULT_IDLE_TIMEOUT_MS;
  }

  async createSession(options: {
    command: string;
    args?: string[];
    cwd?: string;
    env?: Record<string, string>;
    cols?: number;
    rows?: number;
  }): Promise<{ sessionId: string; pid: number; cols: number; rows: number }> {
    const release = await this.managerMutex.acquire();
    try {
      if (this.sessions.size >= MAX_SESSIONS) {
        throw new Error(
          `Maximum sessions (${MAX_SESSIONS}) reached. Kill an existing session first.`,
        );
      }

      const sessionId = nanoid(8);
      const session = new Session({
        sessionId,
        command: options.command,
        args: options.args,
        cwd: options.cwd,
        env: options.env,
        cols: options.cols,
        rows: options.rows,
      });

      this.sessions.set(sessionId, session);

      session.onExit(() => {
        const timer = setTimeout(() => {
          this.sessions.delete(sessionId);
        }, EXIT_CLEANUP_DELAY_MS);
        session.setCleanupTimer(timer);
      });

      const size = session.getScreenSize();
      return {
        sessionId,
        pid: session.ptyProcess.pid,
        cols: size.cols,
        rows: size.rows,
      };
    } finally {
      release();
    }
  }

  getSession(sessionId: string): Session {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    return session;
  }

  listSessions(): Array<{
    sessionId: string;
    command: string;
    pid: number;
    cols: number;
    rows: number;
    status: string;
  }> {
    return Array.from(this.sessions.values()).map((s) => {
      const size = s.getScreenSize();
      return {
        sessionId: s.sessionId,
        command: s.command,
        pid: s.ptyProcess.pid,
        cols: size.cols,
        rows: size.rows,
        status: s.status,
      };
    });
  }

  async killSession(sessionId: string): Promise<void> {
    const release = await this.managerMutex.acquire();
    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }
      session.dispose();
      this.sessions.delete(sessionId);
    } finally {
      release();
    }
  }

  startIdleChecker(): void {
    this.idleCheckInterval = setInterval(() => {
      const now = Date.now();
      for (const [id, session] of this.sessions) {
        if (
          session.status === "running" &&
          now - session.lastActivity > this.idleTimeoutMs
        ) {
          process.stderr.write(
            `[tui-mcp] Killing idle session ${id} (idle ${Math.round((now - session.lastActivity) / 1000)}s)\n`,
          );
          session.dispose();
          this.sessions.delete(id);
        }
      }
    }, IDLE_CHECK_INTERVAL_MS);
  }

  shutdownAll(): void {
    for (const [id, session] of this.sessions) {
      session.dispose();
      this.sessions.delete(id);
    }
    if (this.idleCheckInterval) {
      clearInterval(this.idleCheckInterval);
    }
  }

  get sessionCount(): number {
    return this.sessions.size;
  }
}
