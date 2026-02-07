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
  scrollback?: number;
}

export interface Snapshot {
  content: string;
  cursor: { x: number; y: number };
  rows: number;
  cols: number;
  rawAnsi?: string;
}

export interface BufferInfo {
  total: number;
  viewportY: number;
  baseY: number;
  rows: number;
  cols: number;
  cursor: { x: number; y: number };
  buffer: "active" | "normal" | "alternate";
}

export interface BufferRangeSnapshot {
  content: string;
  start: number;
  count: number;
  returned: number;
  total: number;
  viewportY: number;
  baseY: number;
  rows: number;
  cols: number;
  buffer: "active" | "normal" | "alternate";
}

export class Session {
  public readonly id: string;
  public readonly command: string;
  public readonly pid: number;

  private ptyProcess: pty.IPty;
  private terminal: TerminalType;
  private rawAnsiBuffer: string[] = [];
  private maxRawBufferSize = 10000; // Keep last 10K chars of raw ANSI

  constructor(id: string, options: SessionOptions) {
    const { command, args = [], cwd, cols = 80, rows = 24, scrollback = 5000 } = options;

    this.id = id;
    this.command = command;

    // Create headless xterm for VT parsing
    this.terminal = new Terminal({ cols, rows, scrollback, allowProposedApi: true });

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
      // Capture raw ANSI for debugging
      this.rawAnsiBuffer.push(data);
      // Trim buffer if too large
      const totalLen = this.rawAnsiBuffer.reduce((a, b) => a + b.length, 0);
      while (totalLen > this.maxRawBufferSize && this.rawAnsiBuffer.length > 1) {
        this.rawAnsiBuffer.shift();
      }
    });
  }

  /**
   * Get raw ANSI buffer (for debugging TUIs)
   */
  getRawAnsi(): string {
    return this.rawAnsiBuffer.join("");
  }

  /**
   * Clear raw ANSI buffer
   */
  clearRawAnsi(): void {
    this.rawAnsiBuffer = [];
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
   * Send keystrokes with pacing (one character at a time with delays)
   * This helps with programs that read input character-by-character in raw mode
   */
  async sendKeysPaced(keys: string, paceMs: number = 10, modifiers?: Modifiers): Promise<void> {
    const sequence = resolveKeys(keys, modifiers);
    for (const char of sequence) {
      this.ptyProcess.write(char);
      await new Promise((r) => setTimeout(r, paceMs));
    }
  }

  /**
   * Send a line of text followed by Enter (convenience method)
   */
  sendLine(text: string): void {
    this.ptyProcess.write(text + "\r");
  }

  /**
   * Send a line with pacing (character by character with delays)
   * Use this when the receiving program drops characters from bulk writes
   */
  async sendLinePaced(text: string, paceMs: number = 10): Promise<void> {
    for (const char of text) {
      this.ptyProcess.write(char);
      await new Promise((r) => setTimeout(r, paceMs));
    }
    // Small extra delay before Enter to ensure all chars processed
    await new Promise((r) => setTimeout(r, paceMs));
    this.ptyProcess.write("\r");
  }

  /**
   * Get current cursor position
   */
  getCursor(): { x: number; y: number } {
    const buffer = this.terminal.buffer.active;
    return { x: buffer.cursorX, y: buffer.cursorY };
  }

  /**
   * Wait for screen to stop changing (idle detection)
   */
  async waitForIdle(options: { timeout?: number; stableTime?: number } = {}): Promise<string> {
    const { timeout = 5000, stableTime = 300 } = options;
    const start = Date.now();
    let lastContent = "";
    let stableSince = Date.now();

    while (Date.now() - start < timeout) {
      const snap = this.getSnapshot();
      if (snap.content === lastContent) {
        if (Date.now() - stableSince >= stableTime) {
          return snap.content;
        }
      } else {
        lastContent = snap.content;
        stableSince = Date.now();
      }
      await new Promise((r) => setTimeout(r, 50));
    }

    return this.getSnapshot().content;
  }

  /**
   * Get current screen buffer snapshot
   */
  getSnapshot(options: { includeAnsi?: boolean } = {}): Snapshot {
    const buffer = this.terminal.buffer.active;
    const lines: string[] = [];

    for (let i = 0; i < this.terminal.rows; i++) {
      const line = buffer.getLine(i);
      const text = line?.translateToString(true) || "";
      const lineNum = String(i + 1).padStart(3, " ");
      lines.push(`${lineNum} | ${text}`);
    }

    const snapshot: Snapshot = {
      content: lines.join("\n"),
      cursor: { x: buffer.cursorX, y: buffer.cursorY },
      rows: this.terminal.rows,
      cols: this.terminal.cols,
    };

    if (options.includeAnsi) {
      snapshot.rawAnsi = this.getRawAnsi();
    }

    return snapshot;
  }

  /**
   * Get buffer metadata for deterministic reads
   */
  getBufferInfo(bufferName: "active" | "normal" | "alternate" = "active"): BufferInfo {
    const buffer =
      bufferName === "normal"
        ? this.terminal.buffer.normal
        : bufferName === "alternate"
          ? this.terminal.buffer.alternate
          : this.terminal.buffer.active;

    return {
      total: buffer.length,
      viewportY: buffer.viewportY,
      baseY: buffer.baseY,
      rows: this.terminal.rows,
      cols: this.terminal.cols,
      cursor: { x: buffer.cursorX, y: buffer.cursorY },
      buffer: bufferName,
    };
  }

  /**
   * Get a range of lines from the buffer (including scrollback)
   */
  getBufferRange(options: {
    start: number;
    count: number;
    buffer?: "active" | "normal" | "alternate";
    excludePattern?: string;
    isRegex?: boolean;
    excludeEmpty?: boolean;
  }): BufferRangeSnapshot {
    const bufferName = options.buffer ?? "active";
    const buffer =
      bufferName === "normal"
        ? this.terminal.buffer.normal
        : bufferName === "alternate"
          ? this.terminal.buffer.alternate
          : this.terminal.buffer.active;

    const total = buffer.length;
    let start = Math.trunc(options.start);
    let count = Math.trunc(options.count);

    if (!Number.isFinite(start) || !Number.isFinite(count)) {
      throw new Error("start and count must be finite numbers");
    }

    if (start < 0) {
      start = Math.max(0, total + start);
    }

    if (count < 0) {
      count = 0;
    }

    if (start > total) {
      start = total;
    }

    const end = Math.min(total, start + count);
    const lines: string[] = [];
    const lineNumWidth = Math.max(3, String(total).length);
    const excludeEmpty = options.excludeEmpty ?? false;
    const excludePattern = options.excludePattern;
    const excludeRegex =
      excludePattern && options.isRegex ? new RegExp(excludePattern) : undefined;

    for (let i = start; i < end; i++) {
      const line = buffer.getLine(i);
      const text = line?.translateToString(true) || "";
      if (excludeEmpty && text.trim().length === 0) {
        continue;
      }
      if (excludeRegex && excludeRegex.test(text)) {
        continue;
      }
      if (excludePattern && !options.isRegex && text.includes(excludePattern)) {
        continue;
      }
      const lineNum = String(i + 1).padStart(lineNumWidth, " ");
      lines.push(`${lineNum} | ${text}`);
    }

    return {
      content: lines.join("\n"),
      start,
      count: end - start,
      returned: lines.length,
      total,
      viewportY: buffer.viewportY,
      baseY: buffer.baseY,
      rows: this.terminal.rows,
      cols: this.terminal.cols,
      buffer: bufferName,
    };
  }

  /**
   * Wait for buffer to reach a minimum length
   */
  async waitForBufferLines(options: {
    minTotal?: number;
    minDelta?: number;
    timeout?: number;
    interval?: number;
    buffer?: "active" | "normal" | "alternate";
  }): Promise<number> {
    const bufferName = options.buffer ?? "active";
    const buffer =
      bufferName === "normal"
        ? this.terminal.buffer.normal
        : bufferName === "alternate"
          ? this.terminal.buffer.alternate
          : this.terminal.buffer.active;

    const startLen = buffer.length;
    const minDelta = options.minDelta ?? 0;
    const minTotal = options.minTotal ?? 0;
    const target = Math.max(minTotal, startLen + minDelta);
    const timeout = options.timeout ?? 10000;
    const interval = options.interval ?? 100;
    const startTime = Date.now();

    if (target <= startLen) {
      return startLen;
    }

    while (Date.now() - startTime < timeout) {
      if (buffer.length >= target) {
        return buffer.length;
      }
      await new Promise((r) => setTimeout(r, interval));
    }

    throw new Error(
      `Timeout waiting for buffer lines: target=${target} current=${buffer.length}`
    );
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
