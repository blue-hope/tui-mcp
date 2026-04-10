# tui-mcp

MCP server that launches TUI applications in sandboxed PTY sessions and lets AI agents observe and interact with them.

Like [chrome-devtools MCP](https://github.com/anthropics/chrome-devtools-mcp) for browsers and [mobile-mcp](https://github.com/mobile-next/mobile-mcp) for mobile devices — but for terminal UIs.

## Quick Start

Add to your MCP client config (Claude Desktop, Claude Code, etc.):

```json
{
  "mcpServers": {
    "tui": {
      "command": "npx",
      "args": ["-y", "@blue-hope/tui-mcp"]
    }
  }
}
```

## Tools

### Session Management

| Tool | Description |
|------|-------------|
| `launch` | Launch a TUI app in a new PTY session |
| `list_sessions` | List all active sessions |
| `kill_session` | Terminate a session |

### Observation

| Tool | Description |
|------|-------------|
| `take_snapshot` | Capture screen content, cursor position, and dimensions |
| `get_cursor_position` | Get current cursor X/Y |
| `get_screen_size` | Get terminal cols/rows |

### Input

| Tool | Description |
|------|-------------|
| `type_text` | Send text input to the TUI |
| `press_key` | Send key press (`Enter`, `Ctrl+C`, `Alt+X`, `F5`, etc.) |

### Control

| Tool | Description |
|------|-------------|
| `resize` | Resize the terminal |
| `wait_for_text` | Wait until specific text appears on screen |
| `wait_for_stable` | Wait until screen stops changing |

## Usage Examples

### Launch and interact with vim

```
launch({ command: "vim", args: ["file.txt"] })
→ { sessionId: "a3f8k2x1", pid: 12345, cols: 80, rows: 24 }

type_text({ sessionId: "a3f8k2x1", text: "ihello world" })
press_key({ sessionId: "a3f8k2x1", key: "Escape" })
type_text({ sessionId: "a3f8k2x1", text: ":wq" })
press_key({ sessionId: "a3f8k2x1", key: "Enter" })
```

### Launch lazygit in a specific repo

```
launch({ command: "lazygit", args: [], cwd: "/path/to/repo" })
take_snapshot({ sessionId: "..." })
→ { lines: [...], cursor: { x: 0, y: 0 }, rows: 24, cols: 80 }
```

### Run a shell command and wait for output

```
launch({ command: "npm test" })
wait_for_text({ sessionId: "...", text: "Tests passed", timeout: 30000 })
```

## Key Support

Supports arbitrary key combinations:

- **Named keys**: `Enter`, `Tab`, `Escape`, `Backspace`, `Space`, `Delete`, `Insert`, `Home`, `End`, `PageUp`, `PageDown`
- **Arrow keys**: `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight` (or `Up`, `Down`, `Left`, `Right`)
- **Function keys**: `F1` through `F12`
- **Ctrl combos**: `Ctrl+C`, `Ctrl+Z`, `Ctrl+A`, `Ctrl+D`, etc.
- **Alt combos**: `Alt+X`, `Alt+Enter`, etc.
- **Single characters**: `a`, `1`, `/`, etc.

## Launch Modes

**With args** — direct execution (no shell):
```
launch({ command: "vim", args: ["file.txt"] })
```

**Without args** — executed via shell (supports pipes, globs, env vars):
```
launch({ command: "ls -la | head -20" })
```

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `TUI_MCP_IDLE_TIMEOUT` | `1800000` (30min) | Idle session timeout in ms |

## Architecture

```
AI Agent (Claude, etc.)
    │  stdio (JSON-RPC)
    ▼
TUI-MCP Server
    │
    ├── McpServer (11 tools, Zod schemas)
    ├── SessionManager (up to 10 sessions)
    │   └── Session
    │       ├── node-pty (PTY process)
    │       └── @xterm/headless (terminal emulator)
    └── Key mapper (ANSI sequences)
```

- **node-pty**: Spawns and manages PTY processes
- **@xterm/headless**: Parses ANSI escape sequences into a readable screen buffer
- **Per-session mutex**: Tool calls within a session are serialized
- **All responses**: JSON inside MCP text content

## Development

```bash
git clone https://github.com/blue-hope/tui-mcp.git
cd tui-mcp
npm install
npm run dev      # Run with tsx
npm run build    # Compile TypeScript
npm test         # Run tests
```

## License

MIT
