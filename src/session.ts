/**
 * Session class - wraps node-pty and xterm for PTY control
 */

import * as pty from "node-pty";
import xterm, { type Terminal as TerminalType } from "@xterm/headless";
const { Terminal } = xterm;
import { resolveKeys, type Modifiers } from "./keys.js";

export interface SessionOptions {
  command: string;
  args?: string[];
  cwd?: string;
  cols?: number;
  rows?: number;
}

export interface Snapshot {
  content: string;
  cursor: { x: number; y: number };
  rows: number;
  cols: number;
}

export class Session {
  public readonly id: string;
  public readonly command: string;
  public readonly pid: number;

  private ptyProcess: pty.IPty;
  private terminal: TerminalType;

  constructor(id: string, options: SessionOptions) {
    const { command, args = [], cwd, cols = 80, rows = 24 } = options;

    this.id = id;
    this.command = command;

    // Create headless xterm for VT parsing
    this.terminal = new Terminal({ cols, rows, allowProposedApi: true });

    // Spawn PTY (uses ConPTY on Windows)
    this.ptyProcess = pty.spawn(command, args, {
      name: "xterm-256color",
      cols,
      rows,
      cwd: cwd || process.cwd(),
    });

    this.pid = this.ptyProcess.pid;

    // Pipe PTY output to xterm for buffer management
    this.ptyProcess.onData((data: string) => {
      this.terminal.write(data);
    });
  }


  /**
   * Wait for specific content to appear in the buffer
   */
  async waitForContent(
    pattern: string | RegExp,
    options: { timeout?: number; interval?: number } = {}
  ): Promise<string> {
    const { timeout = 10000, interval = 100 } = options;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const snap = this.getSnapshot();
      if (typeof pattern === "string") {
        if (snap.content.includes(pattern)) {
          return snap.content;
        }
      } else {
        if (pattern.test(snap.content)) {
          return snap.content;
        }
      }
      await new Promise((r) => setTimeout(r, interval));
    }

    throw new Error(`Timeout waiting for content: ${pattern}`);
  }

  /**
   * Send keystrokes to the terminal
   */
  sendKeys(keys: string, modifiers?: Modifiers): void {
    const sequence = resolveKeys(keys, modifiers);
    this.ptyProcess.write(sequence);
  }

  /**
   * Get current screen buffer snapshot
   */
  getSnapshot(): Snapshot {
    const buffer = this.terminal.buffer.active;
    const lines: string[] = [];

    for (let i = 0; i < this.terminal.rows; i++) {
      const line = buffer.getLine(i);
      const text = line?.translateToString(true) || "";
      const lineNum = String(i + 1).padStart(3, " ");
      lines.push(`${lineNum} | ${text}`);
    }

    return {
      content: lines.join("\n"),
      cursor: { x: buffer.cursorX, y: buffer.cursorY },
      rows: this.terminal.rows,
      cols: this.terminal.cols,
    };
  }

  /**
   * Resize terminal dimensions
   */
  resize(cols: number, rows: number): void {
    this.ptyProcess.resize(cols, rows);
    this.terminal.resize(cols, rows);
  }

  /**
   * Get current dimensions
   */
  get dimensions(): { cols: number; rows: number } {
    return { cols: this.terminal.cols, rows: this.terminal.rows };
  }

  /**
   * Close and cleanup the session
   */
  close(): void {
    this.ptyProcess.kill();
    this.terminal.dispose();
  }
}
