/**
 * MCP Server with tool handlers for PTY control
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SessionManager } from "./session-manager.js";
import type { Modifiers } from "./keys.js";

// Singleton manager for test access
let globalManager: SessionManager | null = null;

export function getManager(): SessionManager {
  if (!globalManager) {
    globalManager = new SessionManager();
  }
  return globalManager;
}

// MCP SDK expected return type
type McpToolResult = {
  [x: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
};

interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
}

interface ServerWithCallTool extends McpServer {
  callTool(name: string, args: Record<string, unknown>): Promise<ToolResult>;
}

function toMcpResult(result: ToolResult): McpToolResult {
  return result as McpToolResult;
}

export function createServer(): ServerWithCallTool {
  globalManager = new SessionManager();
  const manager = globalManager;

  const server = new McpServer({
    name: "pty-mcp",
    version: "1.0.0",
  });

  // Tool handlers map for direct testing
  const toolHandlers: Record<
    string,
    (args: Record<string, unknown>) => Promise<ToolResult>
  > = {};

  // spawn_session
  toolHandlers["spawn_session"] = async (args) => {
    const { command, args: cmdArgs, cwd, cols, rows } = args as {
      command: string;
      args?: string[];
      cwd?: string;
      cols?: number;
      rows?: number;
    };
    const session = manager.spawn({
      command,
      args: cmdArgs,
      cwd,
      cols,
      rows,
    });
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ session_id: session.id, pid: session.pid }),
        },
      ],
    };
  };

  server.registerTool(
    "spawn_session",
    {
      title: "Spawn Terminal Session",
      description: "Spawn a new interactive terminal session. This is a REAL PTY (like Windows Terminal), not a command executor. After spawning, use get_snapshot() to see the prompt, then send_keys() to type commands and 'Enter' to execute. Workflow: spawn_session() -> get_snapshot() -> send_keys({keys:'command'}) -> send_keys({keys:'Enter'}) -> get_snapshot() to see output.",
      inputSchema: {
        command: z.string().describe("Command to run (e.g., pwsh.exe, cmd.exe, bash)"),
        args: z.array(z.string()).optional().describe("Command arguments (e.g., ['-NoProfile', '-NoLogo'] for pwsh)"),
        cwd: z.string().optional().describe("Working directory"),
        cols: z.number().optional().describe("Terminal width (default: 80)"),
        rows: z.number().optional().describe("Terminal height (default: 24)"),
      },
    },
    async ({ command, args, cwd, cols, rows }) => {
      const result = await toolHandlers["spawn_session"]({
        command,
        args,
        cwd,
        cols,
        rows,
      });
      return toMcpResult(result);
    }
  );

  // send_keys
  toolHandlers["send_keys"] = async (args) => {
    const { session_id, keys, modifiers } = args as {
      session_id: string;
      keys: string;
      modifiers?: Modifiers;
    };
    const session = manager.get(session_id);
    if (!session) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ success: false, error: "Session not found" }),
          },
        ],
      };
    }
    session.sendKeys(keys, modifiers);
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ success: true }) }],
    };
  };

  server.registerTool(
    "send_keys",
    {
      title: "Send Keys",
      description:
        "Send keystrokes to terminal like a human typing. IMPORTANT: Use 'Enter' as a separate call to execute commands - do NOT use '\\n' in the keys string. Example workflow: send_keys({keys:'pwd'}) then send_keys({keys:'Enter'}) then get_snapshot(). Special keys: Enter, Tab, Escape, Backspace, Delete, Up, Down, Left, Right, Home, End, PageUp, PageDown, F1-F12. Use modifiers for Ctrl+C ({keys:'c', modifiers:{ctrl:true}}).",
      inputSchema: {
        session_id: z.string().describe("Session ID from spawn_session"),
        keys: z.string().describe("Text to type OR a special key name. Use 'Enter' to execute commands (not '\\n'). Examples: 'Get-Date', 'Enter', 'Up', 'Tab'"),
        modifiers: z
          .object({
            ctrl: z.boolean().optional().describe("Hold Ctrl key"),
            alt: z.boolean().optional().describe("Hold Alt key"),
            shift: z.boolean().optional().describe("Hold Shift key"),
          })
          .optional()
          .describe("Key modifiers for combinations like Ctrl+C"),
      },
    },
    async ({ session_id, keys, modifiers }) => {
      const result = await toolHandlers["send_keys"]({
        session_id,
        keys,
        modifiers: modifiers as Modifiers | undefined,
      });
      return toMcpResult(result);
    }
  );

  // get_snapshot
  toolHandlers["get_snapshot"] = async (args) => {
    const { session_id, include_ansi } = args as { session_id: string; include_ansi?: boolean };
    const session = manager.get(session_id);
    if (!session) {
      return {
        content: [
          { type: "text" as const, text: JSON.stringify({ error: "Session not found" }) },
        ],
      };
    }
    const snapshot = session.getSnapshot({ includeAnsi: include_ansi });
    return {
      content: [{ type: "text" as const, text: JSON.stringify(snapshot) }],
    };
  };

  server.registerTool(
    "get_snapshot",
    {
      title: "Get Terminal Snapshot",
      description: "Read the terminal screen - this is your 'eyes' into the terminal. Returns the visible screen buffer with line numbers, cursor position, and dimensions. Use this after sending commands to see the output, check for prompts, or verify the terminal state. Call frequently to see what's happening.",
      inputSchema: {
        session_id: z.string().describe("Session ID from spawn_session"),
        include_ansi: z.boolean().optional().describe("Include raw ANSI escape sequences for debugging TUIs (default: false)"),
      },
    },
    async ({ session_id, include_ansi }) => {
      const result = await toolHandlers["get_snapshot"]({ session_id, include_ansi });
      return toMcpResult(result);
    }
  );

  // resize
  toolHandlers["resize"] = async (args) => {
    const { session_id, cols, rows } = args as {
      session_id: string;
      cols: number;
      rows: number;
    };
    const session = manager.get(session_id);
    if (!session) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ success: false, error: "Session not found" }),
          },
        ],
      };
    }
    session.resize(cols, rows);
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ success: true }) }],
    };
  };

  server.registerTool(
    "resize",
    {
      title: "Resize Terminal",
      description: "Resize terminal dimensions (columns and rows)",
      inputSchema: {
        session_id: z.string().describe("Session ID from spawn_session"),
        cols: z.number().describe("New width in columns"),
        rows: z.number().describe("New height in rows"),
      },
    },
    async ({ session_id, cols, rows }) => {
      const result = await toolHandlers["resize"]({ session_id, cols, rows });
      return toMcpResult(result);
    }
  );

  // list_sessions
  toolHandlers["list_sessions"] = async () => {
    const sessions = manager.list();
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ sessions }) }],
    };
  };

  server.registerTool(
    "list_sessions",
    {
      title: "List Sessions",
      description: "List all active terminal sessions with their IDs, commands, PIDs, and dimensions",
      inputSchema: {},
    },
    async () => {
      const result = await toolHandlers["list_sessions"]({});
      return toMcpResult(result);
    }
  );

  // close_session
  toolHandlers["close_session"] = async (args) => {
    const { session_id } = args as { session_id: string };
    const success = manager.close(session_id);
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ success }) }],
    };
  };

  server.registerTool(
    "close_session",
    {
      title: "Close Session",
      description: "Close and kill a terminal session",
      inputSchema: {
        session_id: z.string().describe("Session ID to close"),
      },
    },
    async ({ session_id }) => {
      const result = await toolHandlers["close_session"]({ session_id });
      return toMcpResult(result);
    }
  );

  // send_line - convenience method that sends text + Enter
  toolHandlers["send_line"] = async (args) => {
    const { session_id, text } = args as { session_id: string; text: string };
    const session = manager.get(session_id);
    if (!session) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ success: false, error: "Session not found" }),
          },
        ],
      };
    }
    session.sendLine(text);
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ success: true }) }],
    };
  };

  server.registerTool(
    "send_line",
    {
      title: "Send Line",
      description:
        "Send a line of text followed by Enter - the most common operation. Equivalent to send_keys({keys: text}) + send_keys({keys: 'Enter'}). Use this for executing commands.",
      inputSchema: {
        session_id: z.string().describe("Session ID from spawn_session"),
        text: z.string().describe("Command or text to send (Enter is added automatically)"),
      },
    },
    async ({ session_id, text }) => {
      const result = await toolHandlers["send_line"]({ session_id, text });
      return toMcpResult(result);
    }
  );

  // wait_for_content - wait for pattern to appear in screen
  toolHandlers["wait_for_content"] = async (args) => {
    const { session_id, pattern, timeout, is_regex } = args as {
      session_id: string;
      pattern: string;
      timeout?: number;
      is_regex?: boolean;
    };
    const session = manager.get(session_id);
    if (!session) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ success: false, error: "Session not found" }),
          },
        ],
      };
    }
    try {
      const searchPattern = is_regex ? new RegExp(pattern) : pattern;
      const content = await session.waitForContent(searchPattern, { timeout: timeout || 10000 });
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ success: true, content }),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: false,
              error: err instanceof Error ? err.message : "Timeout",
            }),
          },
        ],
      };
    }
  };

  server.registerTool(
    "wait_for_content",
    {
      title: "Wait For Content",
      description:
        "Wait for specific content to appear in the terminal screen. Use this after sending commands to wait for output or prompts. Returns the screen content when the pattern is found.",
      inputSchema: {
        session_id: z.string().describe("Session ID from spawn_session"),
        pattern: z.string().describe("Text or regex pattern to wait for (e.g., 'PS .*>' for PowerShell prompt)"),
        timeout: z.number().optional().describe("Timeout in milliseconds (default: 10000)"),
        is_regex: z.boolean().optional().describe("Treat pattern as regex (default: false, treats as literal string)"),
      },
    },
    async ({ session_id, pattern, timeout, is_regex }) => {
      const result = await toolHandlers["wait_for_content"]({
        session_id,
        pattern,
        timeout,
        is_regex,
      });
      return toMcpResult(result);
    }
  );

  // wait_for_idle - wait for screen to stop changing
  toolHandlers["wait_for_idle"] = async (args) => {
    const { session_id, timeout, stable_time } = args as {
      session_id: string;
      timeout?: number;
      stable_time?: number;
    };
    const session = manager.get(session_id);
    if (!session) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ success: false, error: "Session not found" }),
          },
        ],
      };
    }
    const content = await session.waitForIdle({
      timeout: timeout || 5000,
      stableTime: stable_time || 300,
    });
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ success: true, content }),
        },
      ],
    };
  };

  server.registerTool(
    "wait_for_idle",
    {
      title: "Wait For Idle",
      description:
        "Wait for the terminal screen to stop changing. Useful when you don't know exactly what output to expect, but want to wait until the command finishes producing output.",
      inputSchema: {
        session_id: z.string().describe("Session ID from spawn_session"),
        timeout: z.number().optional().describe("Maximum wait time in milliseconds (default: 5000)"),
        stable_time: z.number().optional().describe("How long screen must be stable to be considered idle (default: 300ms)"),
      },
    },
    async ({ session_id, timeout, stable_time }) => {
      const result = await toolHandlers["wait_for_idle"]({
        session_id,
        timeout,
        stable_time,
      });
      return toMcpResult(result);
    }
  );

  // get_cursor - get current cursor position
  toolHandlers["get_cursor"] = async (args) => {
    const { session_id } = args as { session_id: string };
    const session = manager.get(session_id);
    if (!session) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ error: "Session not found" }),
          },
        ],
      };
    }
    const cursor = session.getCursor();
    return {
      content: [{ type: "text" as const, text: JSON.stringify(cursor) }],
    };
  };

  server.registerTool(
    "get_cursor",
    {
      title: "Get Cursor Position",
      description: "Get the current cursor position in the terminal (x=column, y=row, 0-indexed)",
      inputSchema: {
        session_id: z.string().describe("Session ID from spawn_session"),
      },
    },
    async ({ session_id }) => {
      const result = await toolHandlers["get_cursor"]({ session_id });
      return toMcpResult(result);
    }
  );

  // Cleanup on exit
  process.on("SIGINT", () => {
    manager.closeAll();
    process.exit(0);
  });

  // Add callTool method for testing
  const serverWithCallTool = server as ServerWithCallTool;
  serverWithCallTool.callTool = async (
    name: string,
    args: Record<string, unknown>
  ): Promise<ToolResult> => {
    const handler = toolHandlers[name];
    if (!handler) {
      throw new Error(`Unknown tool: ${name}`);
    }
    return handler(args);
  };

  return serverWithCallTool;
}
