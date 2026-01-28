/**
 * Session Manager - manages multiple PTY sessions
 */

import { v4 as uuidv4 } from "uuid";
import { Session, type SessionOptions } from "./session.js";

export interface SessionInfo {
  session_id: string;
  command: string;
  pid: number;
  cols: number;
  rows: number;
}

export class SessionManager {
  private sessions = new Map<string, Session>();

  /**
   * Spawn a new terminal session
   */
  spawn(options: SessionOptions): Session {
    const id = uuidv4();
    const session = new Session(id, options);
    this.sessions.set(id, session);
    return session;
  }

  /**
   * Get a session by ID
   */
  get(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  /**
   * List all active sessions
   */
  list(): SessionInfo[] {
    return Array.from(this.sessions.values()).map((s) => ({
      session_id: s.id,
      command: s.command,
      pid: s.pid,
      ...s.dimensions,
    }));
  }

  /**
   * Close a session by ID
   */
  close(id: string): boolean {
    const session = this.sessions.get(id);
    if (!session) {
      return false;
    }
    session.close();
    this.sessions.delete(id);
    return true;
  }

  /**
   * Close all sessions
   */
  closeAll(): void {
    for (const session of this.sessions.values()) {
      try {
        session.close();
      } catch {
        // Ignore cleanup errors
      }
    }
    this.sessions.clear();
  }
}
