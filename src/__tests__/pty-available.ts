import * as pty from "node-pty";
import { describe } from "vitest";

let _available: boolean | undefined;

export function isPtyAvailable(): boolean {
  if (_available !== undefined) return _available;
  try {
    const p = pty.spawn("/bin/sh", ["-c", "exit 0"], {
      name: "xterm-256color",
      cols: 80,
      rows: 24,
    });
    p.kill();
    _available = true;
  } catch {
    _available = false;
  }
  return _available;
}

export const describePty = isPtyAvailable() ? describe : describe.skip;
