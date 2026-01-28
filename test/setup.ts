/**
 * Test utilities for PTY-MCP tests
 */

/**
 * Sleep for a given number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * PowerShell command - use .exe extension on Windows for node-pty
 */
export const PWSH_COMMAND = process.platform === "win32" ? "pwsh.exe" : "pwsh";

/**
 * Wait for a condition to be true, with timeout
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { timeout = 5000, interval = 100 } = options;
  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (await condition()) {
      return;
    }
    await sleep(interval);
  }

  throw new Error(`waitFor timed out after ${timeout}ms`);
}

/**
 * Default wait time after sending keys (ms)
 */
export const DEFAULT_KEY_WAIT = 800;

/**
 * Wait time for PowerShell to start (ms)
 */
export const PWSH_STARTUP_WAIT = 2500;

/**
 * Pattern to match PowerShell prompt
 */
export const PS_PROMPT_PATTERN = /PS [A-Z]:\\.*>/;
