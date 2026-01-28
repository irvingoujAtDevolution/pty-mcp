#!/usr/bin/env node
/**
 * PTY-MCP Server - Interactive terminal control via MCP
 * "Playwright for terminals"
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer, getManager } from "./server.js";

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();

  // Handle cleanup
  process.on("SIGINT", () => {
    getManager().closeAll();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    getManager().closeAll();
    process.exit(0);
  });

  await server.connect(transport);
  console.error("PTY-MCP server running on stdio");
}

main().catch((error: unknown) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
