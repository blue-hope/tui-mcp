import * as pty from "node-pty";
import { Terminal } from "@xterm/headless";
import { Mutex } from "./mutex.js";

export type SessionStatus = "running" | "exited";

export interface SessionOptions {
  sessionId: string;
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  cols?: number;
  rows?: number;
}

export class Session {
  readonly sessionId: string;
  readonly command: string;
  readonly args: string[];
  readonly ptyProcess: pty.IPty;
  readonly terminal: Terminal;
  readonly mutex = new Mutex();

  status: SessionStatus = "running";
  exitCode: number | undefined;
  signal: number | undefined;
  lastActivity: number = Date.now();
  writeVersion = 0;

  private cleanupTimer: ReturnType<typeof setTimeout> | undefined;
  private onExitCallbacks: Array<() => void> = [];

  constructor(options: SessionOptions) {
    this.sessionId = options.sessionId;
    this.command = options.command;
    this.args = options.args ?? [];

    const cols = options.cols ?? 80;
    const rows = options.rows ?? 24;

    const env: Record<string, string> = {
      ...(process.env as Record<string, string>),
      TERM: "xterm-256color",
      ...options.env,
    };

    if (this.args.length > 0) {
      this.ptyProcess = pty.spawn(this.command, this.args, {
        name: "xterm-256color",
        cols,
        rows,
        cwd: options.cwd,
        env,
      });
    } else {
      const shell = process.env.SHELL || "/bin/sh";
      this.ptyProcess = pty.spawn(shell, ["-c", this.command], {
        name: "xterm-256color",
        cols,
        rows,
        cwd: options.cwd,
        env,
      });
    }

    this.terminal = new Terminal({ cols, rows, scrollback: 1000 });

    this.ptyProcess.onData((data) => {
      this.terminal.write(data, () => {
        this.writeVersion++;
      });
    });

    this.ptyProcess.onExit(({ exitCode, signal }) => {
      this.status = "exited";
      this.exitCode = exitCode;
      this.signal = signal;
      for (const cb of this.onExitCallbacks) {
        cb();
      }
    });
  }

  onExit(callback: () => void): void {
    if (this.status === "exited") {
      callback();
    } else {
      this.onExitCallbacks.push(callback);
    }
  }

  getScreenText(): string[] {
    const lines: string[] = [];
    const buffer = this.terminal.buffer.active;
    for (let y = 0; y < this.terminal.rows; y++) {
      const line = buffer.getLine(y);
      lines.push(line ? line.translateToString(false) : "");
    }
    return lines;
  }

  getCursorPosition(): { x: number; y: number } {
    const buffer = this.terminal.buffer.active;
    return { x: buffer.cursorX, y: buffer.cursorY };
  }

  getScreenSize(): { cols: number; rows: number } {
    return { cols: this.terminal.cols, rows: this.terminal.rows };
  }

  writeInput(data: string): void {
    this.ptyProcess.write(data);
    this.lastActivity = Date.now();
  }

  resize(cols: number, rows: number): void {
    this.ptyProcess.resize(cols, rows);
    this.terminal.resize(cols, rows);
  }

  kill(): void {
    if (this.status === "running") {
      this.ptyProcess.kill();
    }
  }

  dispose(): void {
    this.kill();
    this.terminal.dispose();
    if (this.cleanupTimer) {
      clearTimeout(this.cleanupTimer);
    }
  }

  setCleanupTimer(timer: ReturnType<typeof setTimeout>): void {
    this.cleanupTimer = timer;
  }
}
