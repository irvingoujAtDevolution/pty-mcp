/**
 * Key-to-sequence mapping for terminal control
 */

export interface Modifiers {
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
}

/**
 * Special key names to escape sequences
 */
const SPECIAL_KEYS: Record<string, string> = {
  Enter: "\r",
  Tab: "\t",
  Escape: "\x1b",
  Backspace: "\x7f",
  Delete: "\x1b[3~",
  Space: " ",
  Up: "\x1b[A",
  Down: "\x1b[B",
  Right: "\x1b[C",
  Left: "\x1b[D",
  Home: "\x1b[H",
  End: "\x1b[F",
  PageUp: "\x1b[5~",
  PageDown: "\x1b[6~",
  Insert: "\x1b[2~",
  F1: "\x1bOP",
  F2: "\x1bOQ",
  F3: "\x1bOR",
  F4: "\x1bOS",
  F5: "\x1b[15~",
  F6: "\x1b[17~",
  F7: "\x1b[18~",
  F8: "\x1b[19~",
  F9: "\x1b[20~",
  F10: "\x1b[21~",
  F11: "\x1b[23~",
  F12: "\x1b[24~",
};

/**
 * Arrow key base letters for modified sequences
 */
const ARROW_LETTERS: Record<string, string> = {
  Up: "A",
  Down: "B",
  Right: "C",
  Left: "D",
};

/**
 * Compute modifier parameter for xterm-style sequences
 * modifier: 2=shift, 3=alt, 5=ctrl, 6=ctrl+shift, 7=alt+shift, 8=ctrl+alt+shift
 */
function getModifierParam(modifiers: Modifiers): number {
  let param = 1; // Base is 1

  if (modifiers.shift) param += 1;
  if (modifiers.alt) param += 2;
  if (modifiers.ctrl) param += 4;

  return param;
}

/**
 * Convert character to Ctrl+<char> sequence (ASCII 1-26)
 */
function ctrlKey(char: string): string {
  const code = char.toUpperCase().charCodeAt(0) - 64;
  return String.fromCharCode(code);
}

/**
 * Convert character to Alt+<char> sequence (ESC + char)
 */
function altKey(char: string): string {
  return "\x1b" + char;
}

/**
 * Resolve key name and modifiers to terminal escape sequence
 *
 * @param keys - Key name (e.g., "Enter", "Up") or plain text
 * @param modifiers - Optional modifier keys
 * @returns Terminal escape sequence
 */
export function resolveKeys(keys: string, modifiers?: Modifiers): string {
  const { ctrl, alt, shift } = modifiers || {};
  const hasModifiers = ctrl || alt || shift;

  // Check if it's an arrow key with modifiers
  const arrowLetter = ARROW_LETTERS[keys];
  if (arrowLetter && hasModifiers) {
    const param = getModifierParam({ ctrl, alt, shift });
    return `\x1b[1;${param}${arrowLetter}`;
  }

  // Plain special key (no modifiers)
  if (SPECIAL_KEYS[keys]) {
    return SPECIAL_KEYS[keys];
  }

  // Single character with modifiers
  if (keys.length === 1) {
    if (ctrl) {
      return ctrlKey(keys);
    }
    if (alt) {
      return altKey(keys);
    }
  }

  // Plain text - return as-is
  return keys;
}
