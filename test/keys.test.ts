import { describe, it, expect } from "vitest";
import { resolveKeys } from "../src/keys.js";

describe("Keys Module", () => {
  describe("Special Keys", () => {
    it("K01: Enter key returns carriage return", () => {
      expect(resolveKeys("Enter")).toBe("\r");
    });

    it("K02: Tab key returns tab character", () => {
      expect(resolveKeys("Tab")).toBe("\t");
    });

    it("K03: Escape key returns escape sequence", () => {
      expect(resolveKeys("Escape")).toBe("\x1b");
    });

    it("K04: Backspace returns DEL character", () => {
      expect(resolveKeys("Backspace")).toBe("\x7f");
    });

    it("K05: Delete returns delete sequence", () => {
      expect(resolveKeys("Delete")).toBe("\x1b[3~");
    });

    it("K06: Arrow Up returns up sequence", () => {
      expect(resolveKeys("Up")).toBe("\x1b[A");
    });

    it("K07: Arrow Down returns down sequence", () => {
      expect(resolveKeys("Down")).toBe("\x1b[B");
    });

    it("K08: Arrow Right returns right sequence", () => {
      expect(resolveKeys("Right")).toBe("\x1b[C");
    });

    it("K09: Arrow Left returns left sequence", () => {
      expect(resolveKeys("Left")).toBe("\x1b[D");
    });

    it("K10: Home returns home sequence", () => {
      expect(resolveKeys("Home")).toBe("\x1b[H");
    });

    it("K11: End returns end sequence", () => {
      expect(resolveKeys("End")).toBe("\x1b[F");
    });

    it("K12: PageUp returns page up sequence", () => {
      expect(resolveKeys("PageUp")).toBe("\x1b[5~");
    });

    it("K13: PageDown returns page down sequence", () => {
      expect(resolveKeys("PageDown")).toBe("\x1b[6~");
    });

    it("K14: Space returns space character", () => {
      expect(resolveKeys("Space")).toBe(" ");
    });

    it("K15: Insert returns insert sequence", () => {
      expect(resolveKeys("Insert")).toBe("\x1b[2~");
    });
  });

  describe("Function Keys", () => {
    it("K14: F1 returns F1 sequence", () => {
      expect(resolveKeys("F1")).toBe("\x1bOP");
    });

    it("K15: F5 returns F5 sequence", () => {
      expect(resolveKeys("F5")).toBe("\x1b[15~");
    });

    it("K16: F12 returns F12 sequence", () => {
      expect(resolveKeys("F12")).toBe("\x1b[24~");
    });

    it("F2 returns F2 sequence", () => {
      expect(resolveKeys("F2")).toBe("\x1bOQ");
    });

    it("F3 returns F3 sequence", () => {
      expect(resolveKeys("F3")).toBe("\x1bOR");
    });

    it("F4 returns F4 sequence", () => {
      expect(resolveKeys("F4")).toBe("\x1bOS");
    });

    it("F6 returns F6 sequence", () => {
      expect(resolveKeys("F6")).toBe("\x1b[17~");
    });

    it("F7 returns F7 sequence", () => {
      expect(resolveKeys("F7")).toBe("\x1b[18~");
    });

    it("F8 returns F8 sequence", () => {
      expect(resolveKeys("F8")).toBe("\x1b[19~");
    });

    it("F9 returns F9 sequence", () => {
      expect(resolveKeys("F9")).toBe("\x1b[20~");
    });

    it("F10 returns F10 sequence", () => {
      expect(resolveKeys("F10")).toBe("\x1b[21~");
    });

    it("F11 returns F11 sequence", () => {
      expect(resolveKeys("F11")).toBe("\x1b[23~");
    });
  });

  describe("Ctrl Modifiers", () => {
    it("K17: Ctrl+C returns ETX (ASCII 3)", () => {
      expect(resolveKeys("c", { ctrl: true })).toBe("\x03");
    });

    it("K18: Ctrl+D returns EOT (ASCII 4)", () => {
      expect(resolveKeys("d", { ctrl: true })).toBe("\x04");
    });

    it("K19: Ctrl+Z returns SUB (ASCII 26)", () => {
      expect(resolveKeys("z", { ctrl: true })).toBe("\x1a");
    });

    it("Ctrl+A returns SOH (ASCII 1)", () => {
      expect(resolveKeys("a", { ctrl: true })).toBe("\x01");
    });

    it("Ctrl+L returns FF (ASCII 12)", () => {
      expect(resolveKeys("l", { ctrl: true })).toBe("\x0c");
    });

    it("Ctrl+uppercase works same as lowercase", () => {
      expect(resolveKeys("C", { ctrl: true })).toBe("\x03");
    });
  });

  describe("Alt Modifiers", () => {
    it("K20: Alt+F returns ESC + f", () => {
      expect(resolveKeys("f", { alt: true })).toBe("\x1bf");
    });

    it("Alt+B returns ESC + b", () => {
      expect(resolveKeys("b", { alt: true })).toBe("\x1bb");
    });

    it("Alt+D returns ESC + d", () => {
      expect(resolveKeys("d", { alt: true })).toBe("\x1bd");
    });
  });

  describe("Modified Arrow Keys", () => {
    it("K21: Ctrl+Right returns modified right sequence", () => {
      expect(resolveKeys("Right", { ctrl: true })).toBe("\x1b[1;5C");
    });

    it("K22: Ctrl+Shift+Right returns modified right sequence", () => {
      expect(resolveKeys("Right", { ctrl: true, shift: true })).toBe("\x1b[1;6C");
    });

    it("K23: Shift+Up returns modified up sequence", () => {
      expect(resolveKeys("Up", { shift: true })).toBe("\x1b[1;2A");
    });

    it("Ctrl+Up returns modified up sequence", () => {
      expect(resolveKeys("Up", { ctrl: true })).toBe("\x1b[1;5A");
    });

    it("Ctrl+Down returns modified down sequence", () => {
      expect(resolveKeys("Down", { ctrl: true })).toBe("\x1b[1;5B");
    });

    it("Ctrl+Left returns modified left sequence", () => {
      expect(resolveKeys("Left", { ctrl: true })).toBe("\x1b[1;5D");
    });

    it("Shift+Down returns modified down sequence", () => {
      expect(resolveKeys("Down", { shift: true })).toBe("\x1b[1;2B");
    });

    it("Shift+Left returns modified left sequence", () => {
      expect(resolveKeys("Left", { shift: true })).toBe("\x1b[1;2D");
    });

    it("Shift+Right returns modified right sequence", () => {
      expect(resolveKeys("Right", { shift: true })).toBe("\x1b[1;2C");
    });

    it("Alt+Up returns modified up sequence", () => {
      expect(resolveKeys("Up", { alt: true })).toBe("\x1b[1;3A");
    });

    it("Alt+Down returns modified down sequence", () => {
      expect(resolveKeys("Down", { alt: true })).toBe("\x1b[1;3B");
    });

    it("Alt+Left returns modified left sequence", () => {
      expect(resolveKeys("Left", { alt: true })).toBe("\x1b[1;3D");
    });

    it("Alt+Right returns modified right sequence", () => {
      expect(resolveKeys("Right", { alt: true })).toBe("\x1b[1;3C");
    });

    it("Ctrl+Shift+Up returns modified up sequence", () => {
      expect(resolveKeys("Up", { ctrl: true, shift: true })).toBe("\x1b[1;6A");
    });

    it("Ctrl+Shift+Down returns modified down sequence", () => {
      expect(resolveKeys("Down", { ctrl: true, shift: true })).toBe("\x1b[1;6B");
    });

    it("Ctrl+Shift+Left returns modified left sequence", () => {
      expect(resolveKeys("Left", { ctrl: true, shift: true })).toBe("\x1b[1;6D");
    });
  });

  describe("Plain Text", () => {
    it("K24: Single char returns itself", () => {
      expect(resolveKeys("a")).toBe("a");
    });

    it("K25: Multi char returns itself", () => {
      expect(resolveKeys("hello")).toBe("hello");
    });

    it("K26: Text with spaces returns itself", () => {
      expect(resolveKeys("hello world")).toBe("hello world");
    });

    it("Numbers return themselves", () => {
      expect(resolveKeys("123")).toBe("123");
    });

    it("Special characters return themselves", () => {
      expect(resolveKeys("!@#$%")).toBe("!@#$%");
    });

    it("Mixed alphanumeric returns itself", () => {
      expect(resolveKeys("Get-Process | Select -First 5")).toBe(
        "Get-Process | Select -First 5"
      );
    });
  });
});
