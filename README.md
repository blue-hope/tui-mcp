<p align="center">
  <h1 align="center">tui-mcp</h1>
  <p align="center">
    MCP server for controlling TUI applications through AI agents
    <br />
    <a href="https://www.npmjs.com/package/@blue-hope/tui-mcp"><strong>npm</strong></a>
    &nbsp;&middot;&nbsp;
    <a href="https://github.com/blue-hope/tui-mcp/issues"><strong>Issues</strong></a>
  </p>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@blue-hope/tui-mcp"><img src="https://img.shields.io/npm/v/@blue-hope/tui-mcp.svg" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/@blue-hope/tui-mcp"><img src="https://img.shields.io/npm/dm/@blue-hope/tui-mcp.svg" alt="npm downloads" /></a>
  <a href="https://github.com/blue-hope/tui-mcp/blob/main/LICENSE"><img src="https://img.shields.io/github/license/blue-hope/tui-mcp.svg" alt="license" /></a>
  <a href="https://github.com/blue-hope/tui-mcp"><img src="https://img.shields.io/github/stars/blue-hope/tui-mcp.svg?style=social" alt="GitHub stars" /></a>
</p>

---

Launch TUI applications (vim, htop, lazygit, etc.) in sandboxed PTY sessions and let AI agents observe and interact with them.

Like [chrome-devtools MCP](https://github.com/anthropics/chrome-devtools-mcp) for browsers and [mobile-mcp](https://github.com/mobile-next/mobile-mcp) for mobile devices — but for terminal UIs.

```
Agent: launch({ command: "vim", args: ["main.py"] })
Agent: type_text({ sessionId: "a3f8k2x1", text: "iprint('hello')" })
Agent: press_key({ sessionId: "a3f8k2x1", key: "Escape" })
Agent: type_text({ sessionId: "a3f8k2x1", text: ":wq" })
Agent: press_key({ sessionId: "a3f8k2x1", key: "Enter" })
```

## Quick Start

Add to your MCP client config:

<details>
<summary><strong>Claude Desktop</strong></summary>

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

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

</details>

<details>
<summary><strong>Claude Code</strong></summary>

Add to `.mcp.json` in your project root:

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

</details>

<details>
<summary><strong>Other MCP clients</strong></summary>

Any MCP client that supports stdio transport:

```json
{
  "command": "npx",
  "args": ["-y", "@blue-hope/tui-mcp"]
}
```

</details>

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

## Examples

### Edit a file with vim

```
launch({ command: "vim", args: ["file.txt"] })
→ { sessionId: "a3f8k2x1", pid: 12345, cols: 80, rows: 24 }

type_text({ sessionId: "a3f8k2x1", text: "ihello world" })
press_key({ sessionId: "a3f8k2x1", key: "Escape" })
type_text({ sessionId: "a3f8k2x1", text: ":wq" })
press_key({ sessionId: "a3f8k2x1", key: "Enter" })
```

### Use lazygit in a repo

```
launch({ command: "lazygit", args: [], cwd: "/path/to/repo" })
take_snapshot({ sessionId: "..." })
→ { lines: [...], cursor: { x: 0, y: 0 }, rows: 24, cols: 80 }
```

### Run a command and wait for output

```
launch({ command: "npm test" })
wait_for_text({ sessionId: "...", text: "Tests passed", timeout: 30000 })
```

### Custom environment and dimensions

```
launch({
  command: "htop",
  args: [],
  cols: 120,
  rows: 40,
  env: { "HTOPRC": "/path/to/config" }
})
```

## `launch` Modes

| Mode | When | Example |
|------|------|---------|
| **Direct** | `args` is provided | `launch({ command: "vim", args: ["file.txt"] })` |
| **Shell** | `args` is omitted | `launch({ command: "ls -la \| head -20" })` |

Direct mode calls the binary directly. Shell mode runs through `$SHELL -c "..."`, supporting pipes, globs, and environment variable expansion.

## Key Support

Supports arbitrary key combinations:

| Category | Examples |
|----------|---------|
| Named keys | `Enter`, `Tab`, `Escape`, `Backspace`, `Space`, `Delete`, `Home`, `End`, `PageUp`, `PageDown` |
| Arrow keys | `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight` (or `Up`, `Down`, `Left`, `Right`) |
| Function keys | `F1` through `F12` |
| Ctrl combos | `Ctrl+C`, `Ctrl+Z`, `Ctrl+A`, `Ctrl+D`, ... |
| Alt combos | `Alt+X`, `Alt+Enter`, ... |
| Single chars | `a`, `1`, `/`, ... |

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `TUI_MCP_IDLE_TIMEOUT` | `1800000` (30 min) | Idle session timeout in ms |

## How It Works

```
AI Agent (Claude, Cursor, etc.)
    │  stdio (JSON-RPC 2.0)
    ▼
┌──────────────────────────────────┐
│  tui-mcp server                  │
│                                  │
│  ┌────────────┐  ┌────────────┐  │
│  │ Session A  │  │ Session B  │  │
│  │ ┌────────┐ │  │ ┌────────┐ │  │
│  │ │node-pty│ │  │ │node-pty│ │  │
│  │ └───┬────┘ │  │ └───┬────┘ │  │
│  │     │ PTY  │  │     │ PTY  │  │
│  │ ┌───▼────┐ │  │ ┌───▼────┐ │  │
│  │ │ xterm  │ │  │ │ xterm  │ │  │
│  │ │headless│ │  │ │headless│ │  │
│  │ └────────┘ │  │ └────────┘ │  │
│  └────────────┘  └────────────┘  │
└──────────────────────────────────┘
    │                    │
    ▼                    ▼
  vim                  htop
```

Each session pairs a [node-pty](https://github.com/microsoft/node-pty) process with an [@xterm/headless](https://www.npmjs.com/package/@xterm/headless) terminal emulator. The PTY spawns the TUI app; xterm parses its ANSI output into a readable screen buffer. Tool calls within a session are serialized via a per-session mutex.

## Development

```bash
git clone https://github.com/blue-hope/tui-mcp.git
cd tui-mcp
npm install
npm run dev      # Run with tsx (hot reload)
npm run build    # Compile TypeScript
npm test         # Run tests
```

### Project Structure

```
src/
├── index.ts              # Entry point, MCP server bootstrap
├── session.ts            # Session: PTY + Terminal pair
├── session-manager.ts    # Session lifecycle, idle timeout
├── tools.ts              # 11 MCP tool registrations
├── keys.ts               # Key name → ANSI sequence mapper
├── mutex.ts              # Promise-based FIFO mutex
├── tool-wrapper.ts       # Handler wrapper (logging, errors)
└── __tests__/            # vitest test suite
```

## Requirements

- Node.js >= 18
- macOS or Linux (node-pty requires POSIX)
- C++ build tools for node-pty native module (`node-gyp`)

## License

[MIT](LICENSE)
