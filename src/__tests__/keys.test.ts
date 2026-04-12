import { describe, it, expect } from "vitest";
import { resolveKey } from "../keys.js";

describe("resolveKey", () => {
  describe("base keys", () => {
    it("resolves Enter", () => {
      expect(resolveKey("Enter")).toBe("\r");
    });

    it("resolves Tab", () => {
      expect(resolveKey("Tab")).toBe("\t");
    });

    it("resolves Escape", () => {
      expect(resolveKey("Escape")).toBe("\x1b");
    });

    it("resolves Backspace", () => {
      expect(resolveKey("Backspace")).toBe("\x7f");
    });

    it("resolves Space", () => {
      expect(resolveKey("Space")).toBe(" ");
    });
  });

  describe("arrow keys", () => {
    it("resolves ArrowUp", () => {
      expect(resolveKey("ArrowUp")).toBe("\x1b[A");
    });

    it("resolves ArrowDown", () => {
      expect(resolveKey("ArrowDown")).toBe("\x1b[B");
    });

    it("resolves ArrowRight", () => {
      expect(resolveKey("ArrowRight")).toBe("\x1b[C");
    });

    it("resolves ArrowLeft", () => {
      expect(resolveKey("ArrowLeft")).toBe("\x1b[D");
    });

    it("resolves short aliases (Up/Down/Left/Right)", () => {
      expect(resolveKey("Up")).toBe("\x1b[A");
      expect(resolveKey("Down")).toBe("\x1b[B");
      expect(resolveKey("Left")).toBe("\x1b[D");
      expect(resolveKey("Right")).toBe("\x1b[C");
    });
  });

  describe("function keys", () => {
    it("resolves F1-F4", () => {
      expect(resolveKey("F1")).toBe("\x1bOP");
      expect(resolveKey("F2")).toBe("\x1bOQ");
      expect(resolveKey("F3")).toBe("\x1bOR");
      expect(resolveKey("F4")).toBe("\x1bOS");
    });

    it("resolves F5-F12", () => {
      expect(resolveKey("F5")).toBe("\x1b[15~");
      expect(resolveKey("F6")).toBe("\x1b[17~");
      expect(resolveKey("F12")).toBe("\x1b[24~");
    });
  });

  describe("navigation keys", () => {
    it("resolves Home, End, PageUp, PageDown, Delete, Insert", () => {
      expect(resolveKey("Home")).toBe("\x1b[H");
      expect(resolveKey("End")).toBe("\x1b[F");
      expect(resolveKey("PageUp")).toBe("\x1b[5~");
      expect(resolveKey("PageDown")).toBe("\x1b[6~");
      expect(resolveKey("Delete")).toBe("\x1b[3~");
      expect(resolveKey("Insert")).toBe("\x1b[2~");
    });
  });

  describe("Ctrl combinations", () => {
    it("resolves Ctrl+A = 0x01", () => {
      expect(resolveKey("Ctrl+A")).toBe("\x01");
    });

    it("resolves Ctrl+C = 0x03", () => {
      expect(resolveKey("Ctrl+C")).toBe("\x03");
    });

    it("resolves Ctrl+Z = 0x1A", () => {
      expect(resolveKey("Ctrl+Z")).toBe("\x1a");
    });

    it("resolves Ctrl+D = 0x04", () => {
      expect(resolveKey("Ctrl+D")).toBe("\x04");
    });

    it("is case-insensitive for Ctrl+letter", () => {
      expect(resolveKey("Ctrl+a")).toBe("\x01");
      expect(resolveKey("ctrl+c")).toBe("\x03");
    });
  });

  describe("Alt combinations", () => {
    it("resolves Alt+X with ESC prefix", () => {
      expect(resolveKey("Alt+x")).toBe("\x1bx");
    });

    it("resolves Alt+Enter", () => {
      expect(resolveKey("Alt+Enter")).toBe("\x1b\r");
    });
  });

  describe("modifier + special key (xterm params)", () => {
    it("resolves Alt+ArrowLeft (word left)", () => {
      // \x1b[1;3D = Alt modifier (3) + ArrowLeft (D)
      expect(resolveKey("Alt+ArrowLeft")).toBe("\x1b[1;3D");
    });

    it("resolves Alt+ArrowRight (word right)", () => {
      expect(resolveKey("Alt+ArrowRight")).toBe("\x1b[1;3C");
    });

    it("resolves Opt+Left (macOS alias)", () => {
      expect(resolveKey("Opt+Left")).toBe("\x1b[1;3D");
    });

    it("resolves Opt+Right (macOS alias)", () => {
      expect(resolveKey("Opt+Right")).toBe("\x1b[1;3C");
    });

    it("resolves Ctrl+ArrowUp", () => {
      // modifier = 1 + ctrl(4) = 5
      expect(resolveKey("Ctrl+ArrowUp")).toBe("\x1b[1;5A");
    });

    it("resolves Ctrl+ArrowDown", () => {
      expect(resolveKey("Ctrl+ArrowDown")).toBe("\x1b[1;5B");
    });

    it("resolves Shift+ArrowRight", () => {
      // modifier = 1 + shift(1) = 2
      expect(resolveKey("Shift+ArrowRight")).toBe("\x1b[1;2C");
    });

    it("resolves Ctrl+Shift+ArrowLeft", () => {
      // modifier = 1 + shift(1) + ctrl(4) = 6
      expect(resolveKey("Ctrl+Shift+ArrowLeft")).toBe("\x1b[1;6D");
    });

    it("resolves Alt+Home", () => {
      expect(resolveKey("Alt+Home")).toBe("\x1b[1;3H");
    });

    it("resolves Ctrl+Delete", () => {
      expect(resolveKey("Ctrl+Delete")).toBe("\x1b[3;5~");
    });

    it("resolves Shift+F5", () => {
      expect(resolveKey("Shift+F5")).toBe("\x1b[15;2~");
    });

    it("resolves Alt+F1", () => {
      expect(resolveKey("Alt+F1")).toBe("\x1b[1;3P");
    });
  });

  describe("unknown keys", () => {
    it("throws for unknown key names", () => {
      expect(() => resolveKey("FooBar")).toThrow("Unknown key: FooBar");
    });
  });

  describe("case insensitivity", () => {
    it("resolves keys case-insensitively", () => {
      expect(resolveKey("enter")).toBe("\r");
      expect(resolveKey("ENTER")).toBe("\r");
      expect(resolveKey("escape")).toBe("\x1b");
      expect(resolveKey("ESCAPE")).toBe("\x1b");
    });
  });
});
