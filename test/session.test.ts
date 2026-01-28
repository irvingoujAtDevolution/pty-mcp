import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Session } from "../src/session.js";
import { sleep, PS_PROMPT_PATTERN, PWSH_COMMAND } from "./setup.js";

describe("Session Class", () => {
  let session: Session;

  afterEach(() => {
    if (session) {
      try {
        session.close();
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe("Lifecycle", () => {
    it("S01: Create session returns valid id and pid", async () => {
      session = new Session("test-id-1", { command: PWSH_COMMAND, args: ["-NoProfile", "-NoLogo"] });
      // Wait for PS prompt to appear - proves session is working
      await session.waitForContent(PS_PROMPT_PATTERN);

      expect(session.id).toBe("test-id-1");
      expect(session.pid).toBeGreaterThan(0);
      expect(session.command).toBe(PWSH_COMMAND);
    });

    it("S02: Close session kills PTY without errors", async () => {
      session = new Session("test-id-2", { command: PWSH_COMMAND, args: ["-NoProfile", "-NoLogo"] });
      await sleep(500); // Brief wait for spawn

      expect(() => session.close()).not.toThrow();
    });
  });

  describe("Snapshot", () => {
    beforeEach(async () => {
      session = new Session("snap-test", { command: PWSH_COMMAND, args: ["-NoProfile", "-NoLogo"] });
      // Wait for prompt instead of blind sleep
      await session.waitForContent(PS_PROMPT_PATTERN);
    });

    it("S03: Initial snapshot contains PS prompt", () => {
      const snap = session.getSnapshot();
      expect(snap.content).toMatch(PS_PROMPT_PATTERN);
    });

    it("S04: Snapshot has valid cursor position", () => {
      const snap = session.getSnapshot();
      expect(snap.cursor.x).toBeGreaterThanOrEqual(0);
      expect(snap.cursor.y).toBeGreaterThanOrEqual(0);
    });

    it("S05: Snapshot has default dimensions", () => {
      const snap = session.getSnapshot();
      expect(snap.rows).toBe(24);
      expect(snap.cols).toBe(80);
    });

    it("S06: Snapshot lines have correct format", () => {
      const snap = session.getSnapshot();
      const lines = snap.content.split("\n");

      // Check first line format: "  1 | content"
      expect(lines[0]).toMatch(/^\s+1 \|/);
      // Check line 10 format: " 10 | content"
      expect(lines[9]).toMatch(/^\s+10 \|/);
    });
  });

  describe("Send Keys", () => {
    beforeEach(async () => {
      session = new Session("keys-test", { command: PWSH_COMMAND, args: ["-NoProfile", "-NoLogo"] });
      await session.waitForContent(PS_PROMPT_PATTERN);
    });

    it("S07: Send plain text does not throw", () => {
      expect(() => session.sendKeys("echo test")).not.toThrow();
    });

    it("S08: Send special key (Enter) does not throw", () => {
      expect(() => session.sendKeys("Enter")).not.toThrow();
    });

    it("S09: Send modifier (Ctrl+C) does not throw", () => {
      expect(() => session.sendKeys("c", { ctrl: true })).not.toThrow();
    });
  });

  describe("Resize", () => {
    beforeEach(async () => {
      session = new Session("resize-test", { command: PWSH_COMMAND, args: ["-NoProfile", "-NoLogo"] });
      await session.waitForContent(PS_PROMPT_PATTERN);
    });

    it("S10: Resize changes dimensions", () => {
      session.resize(120, 40);

      const dims = session.dimensions;
      expect(dims.cols).toBe(120);
      expect(dims.rows).toBe(40);
    });

    it("S11: Snapshot reflects new dimensions after resize", () => {
      session.resize(120, 40);

      const snap = session.getSnapshot();
      expect(snap.cols).toBe(120);
      expect(snap.rows).toBe(40);
    });
  });

  describe("Custom Options", () => {
    it("Creates session with custom dimensions", async () => {
      session = new Session("custom-dims", {
        command: PWSH_COMMAND,
        args: ["-NoProfile", "-NoLogo"],
        cols: 100,
        rows: 30,
      });
      await session.waitForContent(PS_PROMPT_PATTERN);

      const snap = session.getSnapshot();
      expect(snap.cols).toBe(100);
      expect(snap.rows).toBe(30);
    });

    it("Creates session with custom cwd", async () => {
      session = new Session("custom-cwd", {
        command: PWSH_COMMAND,
        args: ["-NoProfile", "-NoLogo"],
        cwd: "C:\\",
      });
      // Wait for prompt showing C:\
      await session.waitForContent(/PS C:\\>/);

      const snap = session.getSnapshot();
      expect(snap.content).toContain("C:\\");
    });
  });
});
