# MCP DuckDuckResearch Server Implementation Plan

## Overview

Combine functionalities from `mcp-webresearch` and `duck-duck-mcp` to create a new MCP server with the following tools:
- `search_duckduckgo` - search DuckDuckGo and obtain links
- `visit_page` - visit a webpage and extract its content
- `take_screenshot` - take a screenshot of a webpage

## Project Structure

```
mcp-duckduckresearch/
  ├── src/
  │   ├── index.ts           # Main server entry point
  │   ├── browser.ts         # Browser management
  │   ├── search.ts          # DuckDuckGo integration
  │   ├── types.ts           # Types and schemas
  │   └── utils.ts           # Utility functions
  ├── tests/
  │   ├── unit/              # Unit tests
  │   ├── integration/       # Integration tests
  │   └── fixtures/          # Test fixtures
  ├── package.json
  ├── tsconfig.json
  ├── biome.json            # Biome configuration
  ├── vitest.config.ts      # Vitest configuration
  └── README.md
```

## Dependencies

### Production Dependencies
- @modelcontextprotocol/sdk - Core MCP functionality
- playwright - Web automation
- turndown - HTML to Markdown conversion
- duck-duck-scrape - DuckDuckGo integration
- zod - Schema validation
- zod-to-json-schema - Convert Zod schemas to JSON Schema

### Development Dependencies
- @biomejs/biome - Code formatting and linting
- typescript - TypeScript compiler
- vitest - Testing framework
- @types/* - TypeScript type definitions

## Core Modules

### 1. Main Server (index.ts)
- Server setup and configuration
- Tool registration
- Error handling
- Cleanup management

### 2. Browser Manager (browser.ts)
- Browser lifecycle management
- Page creation and management
- Screenshot optimization
- Content extraction

### 3. Search Module (search.ts)
- DuckDuckGo integration
- Search result processing
- Result metadata enrichment
- Error handling

### 4. Types and Schemas (types.ts)
- TypeScript interfaces
- Zod schemas
- Tool input/output types
- Shared utility types

### 5. Utils (utils.ts)
- URL validation
- Retry mechanism
- File system operations
- Common helper functions

## Tool Implementation Details

### 1. search_duckduckgo
- Use duck-duck-scrape for search
- Add input validation with Zod
- Process and enrich results with metadata
- Handle pagination and result limits
- Add error handling and retries

### 2. visit_page
- Use Playwright for page navigation
- Add security checks and URL validation
- Convert HTML to Markdown
- Handle navigation timeouts and retries
- Support optional screenshot capture
- Clean up resources after use

### 3. take_screenshot
- Use Playwright's screenshot capabilities
- Implement size optimization
- Handle viewport management
- Add file system cleanup
- Support both full page and viewport screenshots

## Testing Strategy

### 1. Unit Tests
- Test URL validation
- Test search result processing
- Test HTML to Markdown conversion
- Test screenshot optimization
- Test retry mechanisms

### 2. Integration Tests
- Test DuckDuckGo search functionality
- Test webpage visits and content extraction
- Test screenshot capture and storage
- Test error handling scenarios

### 3. Test Utilities
- Mock browser for Playwright tests
- Mock DuckDuckGo API responses
- Mock file system operations
- Test data generators

### 4. Test Coverage
- Aim for >80% code coverage
- Focus on critical path testing
- Include edge cases
- Test error scenarios

### 5. Testing Tools
- Vitest for test runner
- Playwright for browser testing
- MSW for API mocking
- Test fixtures and helpers

## Implementation Steps

1. Initial Setup:
   - Create project with npm init
   - Setup TypeScript configuration
   - Configure Biome for linting/formatting
   - Setup Vitest and testing environment

2. Core Implementation:
   - Create basic server structure
   - Implement browser management
   - Add URL validation and utils
   - Setup error handling

3. Tool Implementation:
   - Implement search_duckduckgo tool
   - Implement visit_page tool
   - Implement take_screenshot tool
   - Add validation and error handling

4. Testing:
   - Write unit tests
   - Write integration tests
   - Setup test fixtures
   - Ensure code coverage

5. Documentation:
   - Add README with setup instructions
   - Add JSDoc comments
   - Document tool schemas
   - Include usage examples