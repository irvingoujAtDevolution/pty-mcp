import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SessionManager } from "../src/session-manager.js";
import { sleep, PWSH_STARTUP_WAIT, PWSH_COMMAND } from "./setup.js";

describe("Session Manager", () => {
  let manager: SessionManager;

  beforeEach(() => {
    manager = new SessionManager();
  });

  afterEach(() => {
    manager.closeAll();
  });

  describe("Spawn", () => {
    it("M01: spawn creates session with id", async () => {
      const session = manager.spawn({ command: PWSH_COMMAND, args: ["-NoProfile", "-NoLogo"] });
      await sleep(500);

      expect(session.id).toBeDefined();
      expect(typeof session.id).toBe("string");
      expect(session.id.length).toBeGreaterThan(0);
    });

    it("M01b: spawn returns session with pid", async () => {
      const session = manager.spawn({ command: PWSH_COMMAND, args: ["-NoProfile", "-NoLogo"] });
      await sleep(500);

      expect(session.pid).toBeGreaterThan(0);
    });
  });

  describe("Get", () => {
    it("M02: get retrieves spawned session", async () => {
      const session = manager.spawn({ command: PWSH_COMMAND, args: ["-NoProfile", "-NoLogo"] });
      await sleep(500);

      const retrieved = manager.get(session.id);
      expect(retrieved).toBe(session);
    });

    it("M03: get returns undefined for invalid ID", () => {
      const result = manager.get("invalid-id");
      expect(result).toBeUndefined();
    });
  });

  describe("List", () => {
    it("M04: list returns empty array initially", () => {
      const sessions = manager.list();
      expect(sessions).toEqual([]);
    });

    it("M05: list returns all sessions", async () => {
      manager.spawn({ command: PWSH_COMMAND, args: ["-NoProfile", "-NoLogo"] });
      manager.spawn({ command: PWSH_COMMAND, args: ["-NoProfile", "-NoLogo"] });
      await sleep(500);

      const sessions = manager.list();
      expect(sessions.length).toBe(2);
    });

    it("M06: list includes session info", async () => {
      const session = manager.spawn({
        command: PWSH_COMMAND,
        args: ["-NoProfile", "-NoLogo"],
        cols: 100,
        rows: 30,
      });
      await sleep(500);

      const sessions = manager.list();
      expect(sessions.length).toBe(1);
      expect(sessions[0].session_id).toBe(session.id);
      expect(sessions[0].command).toBe(PWSH_COMMAND);
      expect(sessions[0].pid).toBeGreaterThan(0);
      expect(sessions[0].cols).toBe(100);
      expect(sessions[0].rows).toBe(30);
    });
  });

  describe("Close", () => {
    it("M07: close removes session", async () => {
      const session = manager.spawn({ command: PWSH_COMMAND, args: ["-NoProfile", "-NoLogo"] });
      await sleep(500);

      const result = manager.close(session.id);
      expect(result).toBe(true);

      const retrieved = manager.get(session.id);
      expect(retrieved).toBeUndefined();
    });

    it("M08: close returns false for invalid ID", () => {
      const result = manager.close("invalid-id");
      expect(result).toBe(false);
    });
  });

  describe("Close All", () => {
    it("M09: closeAll removes all sessions", async () => {
      manager.spawn({ command: PWSH_COMMAND, args: ["-NoProfile", "-NoLogo"] });
      manager.spawn({ command: PWSH_COMMAND, args: ["-NoProfile", "-NoLogo"] });
      manager.spawn({ command: PWSH_COMMAND, args: ["-NoProfile", "-NoLogo"] });
      await sleep(500);

      expect(manager.list().length).toBe(3);

      manager.closeAll();

      expect(manager.list().length).toBe(0);
    });
  });
});
