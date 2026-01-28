import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer, getManager } from "../src/server.js";
import { sleep, PWSH_STARTUP_WAIT, PWSH_COMMAND, PS_PROMPT_PATTERN } from "./setup.js";

describe("MCP Server Tools", () => {
  let server: ReturnType<typeof createServer>;

  beforeEach(() => {
    server = createServer();
  });

  afterEach(() => {
    const manager = getManager();
    manager.closeAll();
  });

  describe("spawn_session", () => {
    it("T01: Basic spawn returns session_id and pid", async () => {
      const result = await server.callTool("spawn_session", {
        command: PWSH_COMMAND,
        args: ["-NoProfile", "-NoLogo"],
      });

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe("text");
      const data = JSON.parse(result.content[0].text);
      expect(data.session_id).toBeDefined();
      expect(data.pid).toBeGreaterThan(0);
    });

    it("T02: Spawn with args works", async () => {
      const result = await server.callTool("spawn_session", {
        command: PWSH_COMMAND,
        args: ["-NoProfile", "-NoLogo"],
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.session_id).toBeDefined();
    });

    it("T03: Spawn with custom dimensions", async () => {
      const result = await server.callTool("spawn_session", {
        command: PWSH_COMMAND,
        args: ["-NoProfile", "-NoLogo"],
        cols: 120,
        rows: 40,
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.session_id).toBeDefined();

      // Verify dimensions via get_snapshot
      await sleep(PWSH_STARTUP_WAIT);
      const snap = await server.callTool("get_snapshot", { session_id: data.session_id });
      const snapData = JSON.parse(snap.content[0].text);
      expect(snapData.cols).toBe(120);
      expect(snapData.rows).toBe(40);
    });
  });

  describe("send_keys", () => {
    let sessionId: string;

    beforeEach(async () => {
      const result = await server.callTool("spawn_session", {
        command: PWSH_COMMAND,
        args: ["-NoProfile", "-NoLogo"],
      });
      const data = JSON.parse(result.content[0].text);
      sessionId = data.session_id;
      await sleep(PWSH_STARTUP_WAIT);
    });

    it("T04: Send plain text returns success", async () => {
      const result = await server.callTool("send_keys", {
        session_id: sessionId,
        keys: "test",
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
    });

    it("T05: Send special key (Enter) returns success", async () => {
      const result = await server.callTool("send_keys", {
        session_id: sessionId,
        keys: "Enter",
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
    });

    it("T06: Send with modifier returns success", async () => {
      const result = await server.callTool("send_keys", {
        session_id: sessionId,
        keys: "c",
        modifiers: { ctrl: true },
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
    });

    it("T07: Send to invalid session returns error", async () => {
      const result = await server.callTool("send_keys", {
        session_id: "invalid-session-id",
        keys: "test",
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });
  });

  describe("get_snapshot", () => {
    let sessionId: string;

    beforeEach(async () => {
      const result = await server.callTool("spawn_session", {
        command: PWSH_COMMAND,
        args: ["-NoProfile", "-NoLogo"],
      });
      const data = JSON.parse(result.content[0].text);
      sessionId = data.session_id;
      await sleep(PWSH_STARTUP_WAIT);
    });

    it("T08: Valid session returns snapshot data", async () => {
      const result = await server.callTool("get_snapshot", { session_id: sessionId });

      const data = JSON.parse(result.content[0].text);
      expect(data.content).toBeDefined();
      expect(data.cursor).toBeDefined();
      expect(data.cursor.x).toBeGreaterThanOrEqual(0);
      expect(data.cursor.y).toBeGreaterThanOrEqual(0);
      expect(data.rows).toBe(24);
      expect(data.cols).toBe(80);
    });

    it("T09: Invalid session returns error", async () => {
      const result = await server.callTool("get_snapshot", {
        session_id: "invalid-session-id",
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.error).toBeDefined();
    });
  });

  describe("resize", () => {
    let sessionId: string;

    beforeEach(async () => {
      const result = await server.callTool("spawn_session", {
        command: PWSH_COMMAND,
        args: ["-NoProfile", "-NoLogo"],
      });
      const data = JSON.parse(result.content[0].text);
      sessionId = data.session_id;
      await sleep(500);
    });

    it("T10: Valid resize returns success", async () => {
      const result = await server.callTool("resize", {
        session_id: sessionId,
        cols: 100,
        rows: 30,
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
    });
  });

  describe("list_sessions", () => {
    it("T11: Empty list returns empty array", async () => {
      const result = await server.callTool("list_sessions", {});

      const data = JSON.parse(result.content[0].text);
      expect(data.sessions).toEqual([]);
    });

    it("T12: With sessions returns session info", async () => {
      // Spawn two sessions
      await server.callTool("spawn_session", {
        command: PWSH_COMMAND,
        args: ["-NoProfile", "-NoLogo"],
      });
      await server.callTool("spawn_session", {
        command: PWSH_COMMAND,
        args: ["-NoProfile", "-NoLogo"],
      });
      await sleep(500);

      const result = await server.callTool("list_sessions", {});

      const data = JSON.parse(result.content[0].text);
      expect(data.sessions.length).toBe(2);
      expect(data.sessions[0].session_id).toBeDefined();
      expect(data.sessions[0].command).toBe(PWSH_COMMAND);
      expect(data.sessions[0].pid).toBeGreaterThan(0);
    });
  });

  describe("close_session", () => {
    it("T13: Valid close returns success", async () => {
      const spawnResult = await server.callTool("spawn_session", {
        command: PWSH_COMMAND,
        args: ["-NoProfile", "-NoLogo"],
      });
      const { session_id } = JSON.parse(spawnResult.content[0].text);
      await sleep(500);

      const result = await server.callTool("close_session", { session_id });

      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
    });

    it("T14: Invalid session returns success=false", async () => {
      const result = await server.callTool("close_session", {
        session_id: "invalid-session-id",
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(false);
    });
  });
});
