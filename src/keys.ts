const BASE_KEYS: Record<string, string> = {
  enter: "\r",
  return: "\r",
  tab: "\t",
  escape: "\x1b",
  esc: "\x1b",
  backspace: "\x7f",
  space: " ",
  delete: "\x1b[3~",
  insert: "\x1b[2~",
  home: "\x1b[H",
  end: "\x1b[F",
  pageup: "\x1b[5~",
  pagedown: "\x1b[6~",
  arrowup: "\x1b[A",
  arrowdown: "\x1b[B",
  arrowright: "\x1b[C",
  arrowleft: "\x1b[D",
  up: "\x1b[A",
  down: "\x1b[B",
  right: "\x1b[C",
  left: "\x1b[D",
  f1: "\x1bOP",
  f2: "\x1bOQ",
  f3: "\x1bOR",
  f4: "\x1bOS",
  f5: "\x1b[15~",
  f6: "\x1b[17~",
  f7: "\x1b[18~",
  f8: "\x1b[19~",
  f9: "\x1b[20~",
  f10: "\x1b[21~",
  f11: "\x1b[23~",
  f12: "\x1b[24~",
};

export function resolveKey(key: string): string {
  const parts = key.split("+").map((p) => p.trim());

  if (parts.length === 1) {
    const lower = parts[0].toLowerCase();
    if (BASE_KEYS[lower] !== undefined) {
      return BASE_KEYS[lower];
    }
    if (parts[0].length === 1) {
      return parts[0];
    }
    throw new Error(`Unknown key: ${key}`);
  }

  const modifiers: string[] = [];
  let baseKey = "";

  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower === "ctrl" || lower === "control") {
      modifiers.push("ctrl");
    } else if (lower === "alt" || lower === "meta" || lower === "option") {
      modifiers.push("alt");
    } else if (lower === "shift") {
      modifiers.push("shift");
    } else {
      baseKey = part;
    }
  }

  if (!baseKey) {
    throw new Error(`No base key found in: ${key}`);
  }

  let sequence: string;
  const baseLower = baseKey.toLowerCase();

  if (BASE_KEYS[baseLower] !== undefined) {
    sequence = BASE_KEYS[baseLower];
  } else if (baseKey.length === 1) {
    sequence = baseKey;
  } else {
    throw new Error(`Unknown key: ${baseKey}`);
  }

  if (modifiers.includes("ctrl")) {
    if (baseKey.length === 1 && /[a-zA-Z]/.test(baseKey)) {
      const code = baseKey.toUpperCase().charCodeAt(0) - 64;
      sequence = String.fromCharCode(code);
    } else if (baseLower === "space") {
      sequence = "\x00";
    } else if (baseLower === "backspace") {
      sequence = "\x08";
    } else {
      throw new Error(`Cannot apply Ctrl modifier to key: ${baseKey}`);
    }
  }

  if (modifiers.includes("shift") && baseKey.length === 1) {
    if (!modifiers.includes("ctrl")) {
      sequence = baseKey.toUpperCase();
    }
  }

  if (modifiers.includes("alt")) {
    sequence = "\x1b" + sequence;
  }

  return sequence;
}
