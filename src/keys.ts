// Base key → ANSI escape sequence mapping
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

// Keys that support xterm modifier parameters (\x1b[1;{mod}{letter})
// Format: { suffix, isCSI } where CSI keys use \x1b[1;{mod}{suffix}
// and SS3 keys (F1-F4) use \x1b[1;{mod}{suffix}
const MODIFIER_CAPABLE: Record<string, { param: string; suffix: string }> = {
  arrowup: { param: "1", suffix: "A" },
  arrowdown: { param: "1", suffix: "B" },
  arrowright: { param: "1", suffix: "C" },
  arrowleft: { param: "1", suffix: "D" },
  up: { param: "1", suffix: "A" },
  down: { param: "1", suffix: "B" },
  right: { param: "1", suffix: "C" },
  left: { param: "1", suffix: "D" },
  home: { param: "1", suffix: "H" },
  end: { param: "1", suffix: "F" },
  insert: { param: "2", suffix: "~" },
  delete: { param: "3", suffix: "~" },
  pageup: { param: "5", suffix: "~" },
  pagedown: { param: "6", suffix: "~" },
  f1: { param: "1", suffix: "P" },
  f2: { param: "1", suffix: "Q" },
  f3: { param: "1", suffix: "R" },
  f4: { param: "1", suffix: "S" },
  f5: { param: "15", suffix: "~" },
  f6: { param: "17", suffix: "~" },
  f7: { param: "18", suffix: "~" },
  f8: { param: "19", suffix: "~" },
  f9: { param: "20", suffix: "~" },
  f10: { param: "21", suffix: "~" },
  f11: { param: "23", suffix: "~" },
  f12: { param: "24", suffix: "~" },
};

/**
 * Compute xterm modifier parameter value.
 * modifier = 1 + (shift ? 1 : 0) + (alt ? 2 : 0) + (ctrl ? 4 : 0)
 */
function modifierParam(
  ctrl: boolean,
  alt: boolean,
  shift: boolean,
): number {
  return 1 + (shift ? 1 : 0) + (alt ? 2 : 0) + (ctrl ? 4 : 0);
}

export function resolveKey(key: string): string {
  const parts = key.split("+").map((p) => p.trim());

  // Single key, no modifiers
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

  // Parse modifiers
  let hasCtrl = false;
  let hasAlt = false;
  let hasShift = false;
  let baseKey = "";

  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower === "ctrl" || lower === "control") {
      hasCtrl = true;
    } else if (lower === "alt" || lower === "meta" || lower === "option" || lower === "opt") {
      hasAlt = true;
    } else if (lower === "shift") {
      hasShift = true;
    } else {
      baseKey = part;
    }
  }

  if (!baseKey) {
    throw new Error(`No base key found in: ${key}`);
  }

  const baseLower = baseKey.toLowerCase();

  // Check if this key supports xterm modifier parameters (arrows, F-keys, etc.)
  const modCap = MODIFIER_CAPABLE[baseLower];
  if (modCap && (hasCtrl || hasAlt || hasShift)) {
    const mod = modifierParam(hasCtrl, hasAlt, hasShift);
    // Format: \x1b[{param};{mod}{suffix}
    return `\x1b[${modCap.param};${mod}${modCap.suffix}`;
  }

  // Single character with modifiers
  if (baseKey.length === 1) {
    let sequence = baseKey;

    if (hasCtrl && /[a-zA-Z]/.test(baseKey)) {
      const code = baseKey.toUpperCase().charCodeAt(0) - 64;
      sequence = String.fromCharCode(code);
    } else if (hasCtrl && baseLower === "space") {
      sequence = "\x00";
    } else if (hasCtrl && baseLower === "backspace") {
      sequence = "\x08";
    } else if (hasCtrl) {
      throw new Error(`Cannot apply Ctrl modifier to key: ${baseKey}`);
    }

    if (hasShift && !hasCtrl && baseKey.length === 1) {
      sequence = baseKey.toUpperCase();
    }

    if (hasAlt) {
      sequence = "\x1b" + sequence;
    }

    return sequence;
  }

  // Named key with modifiers but not in MODIFIER_CAPABLE
  // (e.g., Alt+Enter, Alt+Tab, Alt+Escape, Alt+Backspace, Alt+Space)
  if (BASE_KEYS[baseLower] !== undefined) {
    let sequence = BASE_KEYS[baseLower];

    if (hasCtrl) {
      if (baseLower === "space") {
        sequence = "\x00";
      } else if (baseLower === "backspace") {
        sequence = "\x08";
      } else {
        throw new Error(`Cannot apply Ctrl modifier to key: ${baseKey}`);
      }
    }

    if (hasAlt) {
      sequence = "\x1b" + sequence;
    }

    return sequence;
  }

  throw new Error(`Unknown key: ${baseKey}`);
}
