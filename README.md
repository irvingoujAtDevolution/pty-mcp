# PTY-MCP: Interactive Terminal Control for AI Agents

"Playwright for terminals" - gives AI agents full control over interactive terminal sessions.

## Why This Exists

Regular shell execution (`subprocess`, `child_process`) can't handle:
- Interactive prompts (credentials, Y/N confirmations, `Read-Host`)
- Programs that need Ctrl+C to stop
- REPLs that maintain state (Python, Node, PowerShell sessions)
- Full-screen TUI apps
- Commands like `Enter-PSSession` that start interactive sub-sessions

This MCP server gives agents **eyes** (screen buffer) and **hands** (keyboard input) to use terminals like humans do.

## Tools

| Tool | Description |
|------|-------------|
| `spawn_session` | Start a new terminal (pwsh, cmd, bash) |
| `send_keys` | Type text or press special keys |
| `get_snapshot` | Read the current screen buffer |
| `resize` | Change terminal dimensions |
| `list_sessions` | List active sessions |
| `close_session` | Kill a session |

## Correct Usage

### ⚠️ IMPORTANT: Use "Enter" key, not "\n"

This is a **real terminal**, not a command executor. You must interact with it like a human:

```
❌ WRONG - sends literal newline characters, triggers continuation prompt
send_keys({ keys: "pwd\nGet-Date\n" })

✅ CORRECT - type command, press Enter, wait, read output
send_keys({ keys: "pwd" })
send_keys({ keys: "Enter" })
get_snapshot()  // read the output

send_keys({ keys: "Get-Date" })
send_keys({ keys: "Enter" })
get_snapshot()  // read the output
```

### Basic Workflow

```
1. spawn_session({ command: "pwsh.exe", args: ["-NoProfile", "-NoLogo"] })
   → Returns: { session_id: "abc-123", pid: 12345 }

2. get_snapshot({ session_id: "abc-123" })
   → See: "PS C:\Users\jou>" (prompt is ready)

3. send_keys({ session_id: "abc-123", keys: "Get-Date" })
   → Types the command (visible on screen)

4. send_keys({ session_id: "abc-123", keys: "Enter" })
   → Executes the command

5. get_snapshot({ session_id: "abc-123" })
   → See the output:
   "PS C:\Users\jou> Get-Date
    Tuesday, January 28, 2025 10:30:00 PM
    PS C:\Users\jou>"

6. close_session({ session_id: "abc-123" })
   → Clean up when done
```

### Special Keys

Use these key names with `send_keys`:

| Key | Name |
|-----|------|
| Enter | `"Enter"` |
| Tab | `"Tab"` |
| Escape | `"Escape"` |
| Backspace | `"Backspace"` |
| Delete | `"Delete"` |
| Arrow keys | `"Up"`, `"Down"`, `"Left"`, `"Right"` |
| Home/End | `"Home"`, `"End"` |
| Page Up/Down | `"PageUp"`, `"PageDown"` |
| Function keys | `"F1"` through `"F12"` |

### Key Modifiers (Ctrl, Alt, Shift)

```
// Ctrl+C to interrupt
send_keys({ keys: "c", modifiers: { ctrl: true } })

// Ctrl+D to send EOF
send_keys({ keys: "d", modifiers: { ctrl: true } })

// Ctrl+L to clear screen
send_keys({ keys: "l", modifiers: { ctrl: true } })

// Ctrl+Right to move word forward
send_keys({ keys: "Right", modifiers: { ctrl: true } })

// Ctrl+Shift+Right to select word
send_keys({ keys: "Right", modifiers: { ctrl: true, shift: true } })
```

## Examples

### Run a command and get output

```
spawn_session({ command: "pwsh.exe", args: ["-NoProfile", "-NoLogo"] })
// Wait for prompt...
get_snapshot()  // Should see "PS ...>"

send_keys({ keys: "Get-Process | Select -First 3" })
send_keys({ keys: "Enter" })
// Wait for output...
get_snapshot()  // See the process list

close_session({ session_id: "..." })
```

### Handle interactive prompt (Read-Host)

```
send_keys({ keys: "$name = Read-Host 'Enter your name'" })
send_keys({ keys: "Enter" })
get_snapshot()  // See: "Enter your name: "

send_keys({ keys: "Alice" })
send_keys({ keys: "Enter" })
get_snapshot()  // Back to prompt

send_keys({ keys: "Write-Host \"Hello, $name\"" })
send_keys({ keys: "Enter" })
get_snapshot()  // See: "Hello, Alice"
```

### Interrupt a long-running command

```
send_keys({ keys: "Start-Sleep -Seconds 300" })
send_keys({ keys: "Enter" })
// Oops, that's too long...

send_keys({ keys: "c", modifiers: { ctrl: true } })  // Ctrl+C
get_snapshot()  // Back to prompt
```

### Navigate command history

```
send_keys({ keys: "Get-Date" })
send_keys({ keys: "Enter" })
// ... do other things ...

send_keys({ keys: "Up" })      // Previous command
get_snapshot()                  // See "Get-Date" on command line
send_keys({ keys: "Enter" })   // Run it again
```

## Snapshot Format

`get_snapshot` returns:

```json
{
  "content": "  1 | PS C:\\Users\\jou> Get-Date\n  2 | Tuesday, January 28, 2025\n  3 | \n...",
  "cursor": { "x": 20, "y": 2 },
  "rows": 24,
  "cols": 80
}
```

- `content`: Screen buffer with line numbers (like `cat -n`)
- `cursor`: Current cursor position
- `rows`/`cols`: Terminal dimensions

## Tips for AI Agents

1. **Always wait for the prompt** before sending the next command
2. **One command at a time** - type, Enter, wait, read
3. **Use `get_snapshot` liberally** - it's your eyes into the terminal
4. **Use Ctrl+C** if something hangs or enters unexpected state
5. **Check for prompts** like `[Y/N]`, `Password:`, `>>` (continuation)
6. **Close sessions** when done to free resources

## Installation

```bash
npm install
npm run build
```

Add to your MCP config:

```bash
# Codex CLI
codex mcp add pty-mcp -- node /path/to/dist/index.js

# Claude Code
claude mcp add pty-mcp -- node /path/to/dist/index.js
```

## Development

```bash
npm test          # Run all tests (116 tests)
npm run typecheck # Type checking
npm run lint      # Linting
npm run build     # Build for production
```
