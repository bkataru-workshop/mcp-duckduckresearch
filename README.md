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

## Usage

Start the server:

```bash
npm start
```

The server will start and listen on stdio for MCP protocol commands.

### Available Tools

#### 1. search_duckduckgo

Search the web using DuckDuckGo.

```typescript
// Example request
{
  "name": "search_duckduckgo",
  "arguments": {
    "query": "typescript mcp server",
    "options": {
      "region": "zh-cn",
      "safeSearch": "MODERATE",
      "numResults": 50
    }
  }
}
```

#### 2. visit_page

Visit a webpage and extract its content as Markdown.

```typescript
// Example request
{
  "name": "visit_page",
  "arguments": {
    "url": "https://example.com",
    "takeScreenshot": false
  }
}
```

#### 3. take_screenshot

Take a screenshot of the current page.

```typescript
// Example request
{
  "name": "take_screenshot",
  "arguments": {}
}
```

### Example Usage Flow

Here's a complete example of searching for information and visiting a result:

```typescript
// 1. Search for information
const searchRequest = {
  jsonrpc: "2.0",
  id: "1",
  method: "callTool",
  params: {
    name: "search_duckduckgo",
    arguments: {
      query: "TypeScript best practices",
      options: {
        numResults: 10
      }
    }
  }
};

// 2. Visit the first result
const visitRequest = {
  jsonrpc: "2.0",
  id: "2",
  method: "callTool",
  params: {
    name: "visit_page",
    arguments: {
      url: "https://example.com/typescript-practices",
      takeScreenshot: true
    }
  }
};
```

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