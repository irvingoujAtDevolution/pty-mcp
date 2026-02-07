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

### Core Tools

| Tool | Description |
|------|-------------|
| `spawn_session` | Start a new terminal (pwsh, cmd, bash) |
| `send_keys` | Type text or press special keys |
| `send_line` | **NEW** Send text + Enter (most common operation) |
| `get_snapshot` | Read the current screen buffer |
| `get_buffer_range` | **NEW** Read buffer lines (includes scrollback) |
| `get_buffer_info` | **NEW** Read buffer metadata (length, viewport, cursor) |
| `get_cursor` | **NEW** Get cursor position (x, y) |
| `resize` | Change terminal dimensions |
| `list_sessions` | List active sessions |
| `close_session` | Kill a session |

### Wait Tools (for synchronization)

| Tool | Description |
|------|-------------|
| `wait_for_content` | **NEW** Wait for specific text/pattern to appear |
| `wait_for_idle` | **NEW** Wait for screen to stop changing |
| `wait_for_buffer_lines` | **NEW** Wait for buffer line count to increase |

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

### Basic Workflow (Recommended)

```
1. spawn_session({ command: "pwsh.exe", args: ["-NoProfile", "-NoLogo"] })
   → Returns: { session_id: "abc-123", pid: 12345 }

2. wait_for_content({ session_id: "abc-123", pattern: "PS .*>", is_regex: true })
   → Waits for prompt, returns screen content

3. send_line({ session_id: "abc-123", text: "Get-Date" })
   → Types command + presses Enter (one call!)

4. wait_for_content({ session_id: "abc-123", pattern: "PS .*>", is_regex: true })
   → Waits for next prompt (command finished)
   → Returns screen with output

5. close_session({ session_id: "abc-123" })
   → Clean up when done
```

### Alternative: Manual Control

```
1. spawn_session({ command: "pwsh.exe", args: ["-NoProfile", "-NoLogo"] })

2. get_snapshot({ session_id: "abc-123" })
   → See: "PS C:\Users\jou>" (prompt is ready)

3. send_keys({ session_id: "abc-123", keys: "Get-Date" })
   → Types the command

4. send_keys({ session_id: "abc-123", keys: "Enter" })
   → Executes the command

5. wait_for_idle({ session_id: "abc-123" })
   → Wait for output to finish

6. get_snapshot({ session_id: "abc-123" })
   → See the output
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

### Using wait tools (recommended)

```
// Wait for PowerShell prompt
wait_for_content({ session_id, pattern: "PS .*>", is_regex: true })

// Wait for specific output
send_line({ session_id, text: "Get-Process explorer" })
wait_for_content({ session_id, pattern: "explorer" })

// Wait for command to finish (screen stops changing)
send_line({ session_id, text: "Get-Process | Sort-Object CPU -Descending" })
wait_for_idle({ session_id, timeout: 10000 })
get_snapshot({ session_id })

// Wait with timeout
wait_for_content({
  session_id,
  pattern: "Password:",
  timeout: 30000  // 30 seconds
})
```

### Debugging TUIs (vim, htop, etc.)

```
// Get raw ANSI escape sequences for debugging
get_snapshot({ session_id, include_ansi: true })
→ Returns: { content: "...", rawAnsi: "\x1b[1;1H\x1b[2J..." }
```

### Read scrollback (long output)

```
send_line({ session_id, text: "Get-Content big.log" })
wait_for_idle({ session_id, timeout: 10000 })

// Read last 200 lines from buffer
get_buffer_range({ session_id, start: -200, count: 200 })
```

### Deterministic reads (buffer metadata)

```
const info = get_buffer_info({ session_id })
// info.total is the buffer length (including scrollback)
get_buffer_range({ session_id, start: info.total - 200, count: 200 })
```

### Wait for long output (line count)

```
send_line({ session_id, text: "1..500 | ForEach-Object { \"Line $_\" }" })
wait_for_buffer_lines({ session_id, min_delta: 500, timeout: 10000 })
get_buffer_range({ session_id, start: -50, count: 50, exclude_pattern: "PS ", is_regex: false })
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
