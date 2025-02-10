# MCP DuckDuckResearch

An MCP (Model Context Protocol) server that combines DuckDuckGo search capabilities with web page content extraction and screenshot functionality. This server bridges the gap between searching for information and accessing web content programmatically.

## Features

- 🔍 **DuckDuckGo Search**: Search the web using DuckDuckGo's search engine
- 📄 **Content Extraction**: Visit web pages and extract their content as Markdown
- 📸 **Screenshot Capture**: Take screenshots of web pages with automatic size optimization
- ⚡ **Robust Error Handling**: Built-in protection against bot detection and content validation
- 🔒 **Safe Search Options**: Configurable safe search levels for appropriate content filtering

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/mcp-duckduckresearch.git
cd mcp-duckduckresearch

# Install dependencies
npm install

# Build the project
npm run build
```

## Usage with Cline and Roo Code

### Installation for Cline

1. Build the project first using the installation steps above
2. Configure the MCP server in your Cline settings:
   
   Edit your Cline MCP settings file at:
   `%APPDATA%\Code\User\globalStorage\rooveterinaryinc.roo-cline\settings\cline_mcp_settings.json`

   Add the following configuration:

   ```json
   {
     "mcpServers": {
       "duckduckmcp": {
         "command": "node",
         "args": ["path/to/mcp-duckduckresearch/build/index.js"],
         "disabled": false,
         "alwaysAllow": []
       }
     }
   }
   ```

   Replace `path/to/mcp-duckduckresearch` with the actual path where you cloned this repository.

### Available Tools

Once configured, the following tools will be available in Roo Code:

#### 1. search_duckduckgo

Search the web using DuckDuckGo. Example usage in Roo Code:

```typescript
<use_mcp_tool>
<server_name>duckduckmcp</server_name>
<tool_name>search_duckduckgo</tool_name>
<arguments>
{
  "query": "typescript best practices",
  "options": {
    "region": "zh-cn",
    "safeSearch": "MODERATE",
    "numResults": 10
  }
}
</arguments>
</use_mcp_tool>
```

#### 2. visit_page

Visit a webpage and extract its content as Markdown:

```typescript
<use_mcp_tool>
<server_name>duckduckmcp</server_name>
<tool_name>visit_page</tool_name>
<arguments>
{
  "url": "https://example.com",
  "takeScreenshot": false
}
</arguments>
</use_mcp_tool>
```

#### 3. take_screenshot

Take a screenshot of the currently loaded page:

```typescript
<use_mcp_tool>
<server_name>duckduckmcp</server_name>
<tool_name>take_screenshot</tool_name>
<arguments>
{}
</arguments>
</use_mcp_tool>
```

### Example Workflow in Roo Code

Here's a complete example of searching for information and visiting a result:

1. First, search for information:
```typescript
<use_mcp_tool>
<server_name>duckduckmcp</server_name>
<tool_name>search_duckduckgo</tool_name>
<arguments>
{
  "query": "TypeScript best practices",
  "options": {
    "numResults": 10,
    "safeSearch": "MODERATE"
  }
}
</arguments>
</use_mcp_tool>
```

2. Then, visit one of the results:
```typescript
<use_mcp_tool>
<server_name>duckduckmcp</server_name>
<tool_name>visit_page</tool_name>
<arguments>
{
  "url": "https://example.com/typescript-practices",
  "takeScreenshot": true
}
</arguments>
</use_mcp_tool>
```

The server will automatically handle:
- Browser initialization and cleanup
- Content extraction and conversion to Markdown
- Screenshot capture and optimization
- Error handling and retries

## Development

### Prerequisites

- Node.js (v18 or higher)
- npm
- A system capable of running Chrome/Chromium (for Playwright)

### Setup Development Environment

```bash
# Install dependencies
npm install

# Start in development mode
npm run dev

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Format code
npm run format

# Lint code
npm run lint
```

### Project Structure

```
mcp-duckduckresearch/
├── src/
│   ├── browser.ts     # Browser management and content extraction
│   ├── search.ts      # DuckDuckGo search implementation
│   ├── types.ts       # Type definitions and schemas
│   ├── utils.ts       # Utility functions
│   └── index.ts       # Main server implementation
├── tests/
│   ├── unit/          # Unit tests
│   └── integration/   # Integration tests
└── package.json       # Project configuration
```

## Testing

The project uses Vitest for testing. Tests are organized into:

- **Unit Tests**: Testing individual components and functions
- **Integration Tests**: Testing the complete workflow
- **Test Coverage**: Aiming for >80% coverage

Run tests with:

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Credits

- [duck-duck-scrape](https://github.com/duckduckgo/duck-duck-scrape) - DuckDuckGo search implementation
- [Playwright](https://playwright.dev/) - Browser automation and screenshots
- [Model Context Protocol](https://github.com/modelcontextprotocol/spec) - MCP specification and SDK