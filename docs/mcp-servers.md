# MCP Servers Configuration

This project includes a `.mcp.json` configuration file that automatically enables certain MCP (Model Context Protocol) servers for all developers working in this repository. When you run Claude Code in this project, these servers will be available automatically.

## Available MCP Servers

### Next.js DevTools MCP

**What it does**: Provides Next.js development tools and utilities for coding agents like Claude and Cursor.

**Requirements**: Node.js >= 20.0.9 and npm or pnpm

**Key Architecture Points:**

For Next.js 16+ projects: This server automatically discovers and connects to your running Next.js dev server's built-in MCP endpoint at <http://localhost:PORT/_next/mcp>. This gives coding agents direct access to runtime errors, routes, logs, and application state.

For all Next.js projects: Provides development automation tools (upgrades, Cache Components setup), documentation access, and browser testing capabilities that work independently of the runtime connection.

Auto-discovery: The nextjs_runtime tool scans common ports (3000, 3001, etc.) to find running Next.js servers, so you don't need to manually specify ports in most cases.

### Context7 MCP Server

**What it does**: Provides up-to-date, version-specific documentation and code examples for libraries directly in your prompts.

**Requirements**: Node.js >= 18.0.0

**Configuration**: The `.mcp.json` file at the project root contains:

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"],
      "env": {}
    }
  }
}
```

**Usage Instructions for Claude Code**: Always use Context7 when you need code generation, setup or configuration steps, or library/API documentation. This means you should automatically use the Context7 MCP tools to resolve library IDs and get library docs without the user having to explicitly ask.

**First-time Setup**: When you first run Claude Code in this project, it will automatically detect and load the Context7 MCP server from the `.mcp.json` file. You may need to restart Claude Code for the changes to take effect.

### Shadcn MCP Server

**What it does**: Allows you to browse, search, and install components from shadcn/ui registries. Enables Claude Code to interact with shadcn components, blocks, examples, and themes using natural language.

**Requirements**:

- Node.js >= 18.0.0
- A `components.json` file in the project root (already configured for this project)

**Configuration**: The `.mcp.json` file at the project root contains:

```json
{
  "mcpServers": {
    "shadcn": {
      "command": "cmd",
      "args": ["/c", "npx", "shadcn@latest", "mcp"]
    }
  }
}
```

**Usage Instructions for Claude Code**: The Shadcn MCP server automatically enables Claude to:

- Browse all available components from configured registries
- Search for specific components using fuzzy matching
- View detailed component information including source code
- Find usage examples and demos with complete implementation code
- Get CLI commands to add components to your project
- Verify component installations with audit checklists

**Key Features**:

- **Browse Components**: List all 443 items (59 UI components, 155 blocks, 173 examples)
- **Search Across Registries**: Fuzzy search for components, blocks, charts, and themes
- **Install with Natural Language**: Request components and get exact installation commands
- **Support for Multiple Registries**: Currently configured for @shadcn registry

**Available in @shadcn Registry**:

- **UI Components**: accordion, alert, button, card, dialog, form, input, select, table, tabs, etc.
- **Blocks**: dashboard layouts, sidebar variations, login/signup forms, calendar pickers, chart examples
- **Examples**: Component demos showing variants, states, and integration patterns
- **Themes**: stone, zinc, neutral, gray, slate color schemes
- **Utilities**: hooks (use-mobile), lib functions (utils)

**Example Usage**:

```text
User: "Add a button and card component"
Claude: Uses MCP to get installation command → pnpm dlx shadcn@latest add button card

User: "Show me calendar picker examples"
Claude: Uses MCP to search and display calendar-22 (date picker) with full code

User: "What sidebar variations are available?"
Claude: Uses MCP to list sidebar-01 through sidebar-16 with descriptions
```

**First-time Setup**: When you first run Claude Code in this project, it will automatically detect and load the Shadcn MCP server from the `.mcp.json` file. You may need to restart Claude Code for the changes to take effect.

## Configuring Additional MCP Servers

To add more MCP servers to this project:

1. Edit the `.mcp.json` file at the project root
2. Add a new entry to the `mcpServers` object
3. Restart Claude Code to load the new server

Example:

```json
{
  "mcpServers": {
    "context7": {
      /* ... */
    },
    "shadcn": {
      /* ... */
    },
    "your-new-server": {
      "command": "npx",
      "args": ["-y", "@your/mcp-server"],
      "env": {}
    }
  }
}
```

## Troubleshooting MCP Servers

### Server Not Loading

If an MCP server isn't available:

1. Check that the `.mcp.json` file is valid JSON
2. Verify Node.js version meets requirements
3. Restart Claude Code completely
4. Check Claude Code logs for error messages

### Permission Errors

If you see permission errors:

1. Ensure Node.js is installed and in PATH
2. Check that npx can execute commands
3. Verify internet connectivity (for downloading packages)

### Performance Issues

If MCP servers are slow:

1. Check network connectivity
2. Clear npm/npx cache: `npx clear-npx-cache`
3. Update to latest Node.js version
