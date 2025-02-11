# Test Failure Report

**Objective:**
Investigate and resolve test failures in the `mcp-duckduckresearch` project.

**Current Status of Test Failures:**
- Integration tests in `tests/integration/server.test.ts` and `tests/integration/list-tools.test.ts` are failing with timeouts, specifically in the "Tool Execution" tests (timeout after 30 seconds). The error message is "Request timed out". Additionally, the server is responding with "Method not found" errors for the integration tests.
- Unit tests in `tests/unit` are mostly passing, except for `tests/unit/utils.test.ts` which has an "Unhandled Rejection: Error: persistent failure" and "Error cleaning up screenshots: Error: read error".

**Troubleshooting Steps Taken:**
1. **Increased test timeout:** Increased `timeout` in `sendRequest` function in `tests/integration/server.test.ts` to 30 seconds and then to 120 seconds. (No effect on integration test timeouts)
2. **Added debug statements:** Added extensive debug/print statements in `src/index.ts`, `src/search.ts`, `src/browser.ts` and `tests/integration/server.test.ts` to trace execution flow and identify error sources. (Debug statements in `src/index.ts` are now appearing, but integration tests still time out and show "Method not found" errors)
3. **Simplified integration test case:** Created a simplified integration test file `tests/integration/list-tools.test.ts` focusing only on "Tool listing" functionality. (Still failing with timeout)
4. **Removed mocks in integration tests:** Removed mocks for `performSearch` and `browserManager` in `tests/integration/server.test.ts` to test full integration. (No effect on integration test timeouts)
5. **Checked method names and schemas:** Verified that method names in test requests and server-side request handlers (`src/index.ts`) match, and updated input schema for `search_duckduckgo` to use `zodToJsonSchema`. (No effect on integration test timeouts)
6. **Added logging to TestTransport:** Added logging to `TestTransport` class in `tests/integration/server.test.ts` to track message flow. (Logging shows messages are being sent and received by test transport, but server responds with "Method not found")
7. **Checked for duplicate server instances:** Removed the automatic server run in `src/index.ts` to prevent potential conflicts with test setup. (No effect on integration test timeouts)

**Possible Root Causes (Based on Current Knowledge):**
- **Underlying issue with TestTransport:** There might be subtle issues in `TestTransport` preventing proper message handling or causing deadlocks in integration tests.
- **MCP SDK Server issue:** Potential issues within `@modelcontextprotocol/sdk/server/index.js` in request routing or handling, even though ListToolsRequestSchema handler seems to be registered and called.
- **Environment-specific factors:** Resource contention or system configuration on the user's machine might be contributing to slow test execution and timeouts.
- **Persistent Unit Test Failures:** The "Unhandled Rejection" and screenshot cleanup errors in `tests/unit/utils.test.ts` might indicate underlying instability or issues in unit test setup.

**Next Actions:**
- **Deep dive into TestTransport:** Conduct a more in-depth review of `TestTransport` implementation for potential subtle errors or inefficiencies in message handling and asynchronous operations.
- **Examine MCP SDK Server Code:** If possible, examine the source code of `@modelcontextprotocol/sdk/server/index.js` to understand the request routing and handling logic in detail and identify potential issues within the SDK.
- **Investigate Unit Test Failures:** Thoroughly investigate the "Unhandled Rejection" and screenshot cleanup errors in `tests/unit/utils.test.ts`. These unit test failures, while seemingly isolated, might point to broader environment or configuration issues affecting test stability.
- **Seek Expert Environment Review:** If the above steps don't yield a solution, consider seeking expert review of the test environment and MCP SDK integration setup to identify any overlooked configuration problems or environment-specific factors causing the failures.

**Conclusion:**
Integration tests are consistently failing with timeouts and "Method not found" errors, suggesting a deeper issue in request handling or test setup. While unit tests are mostly passing, persistent failures in `tests/unit/utils.test.ts` and integration test timeouts indicate potential instability. Further investigation is needed, potentially requiring expert review of the test environment and MCP SDK integration.

**MCP SDK File Structure**

```
here's the file structure for the SDK

 Get-ChildItem -Recurse ".\node_modules\@modelcontextprotocol\" | Where { ! $_.PSIsContainer } | Select -ExpandProperty FullName | % { $_.Split("\")[2..1000] -Join "\" }
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\LICENSE
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\package.json
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\README.md
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\cli.d.ts
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\cli.d.ts.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\cli.js
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\cli.js.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\inMemory.d.ts
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\inMemory.d.ts.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\inMemory.js
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\inMemory.js.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\package.json
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\types.d.ts
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\types.d.ts.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\types.js
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\types.js.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\client\index.d.ts
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\client\index.d.ts.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\client\index.js
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\client\index.js.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\client\sse.d.ts
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\client\sse.d.ts.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\client\sse.js
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\client\sse.js.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\client\stdio.d.ts
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\client\stdio.d.ts.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\client\stdio.js
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\client\stdio.js.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\client\websocket.d.ts
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\client\websocket.d.ts.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\client\websocket.js
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\client\websocket.js.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\server\completable.d.ts
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\server\completable.d.ts.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\server\completable.js
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\server\completable.js.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\server\index.d.ts
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\server\index.d.ts.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\server\index.js
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\server\index.js.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\server\mcp.d.ts
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\server\mcp.d.ts.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\server\mcp.js
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\server\mcp.js.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\server\sse.d.ts
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\server\sse.d.ts.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\server\sse.js
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\server\sse.js.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\server\stdio.d.ts
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\server\stdio.d.ts.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\server\stdio.js
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\server\stdio.js.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\shared\protocol.d.ts
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\shared\protocol.d.ts.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\shared\protocol.js
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\shared\protocol.js.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\shared\stdio.d.ts
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\shared\stdio.d.ts.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\shared\stdio.js
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\shared\stdio.js.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\shared\transport.d.ts
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\shared\transport.d.ts.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\shared\transport.js
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\shared\transport.js.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\shared\uriTemplate.d.ts
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\shared\uriTemplate.d.ts.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\shared\uriTemplate.js
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\cjs\shared\uriTemplate.js.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\cli.d.ts
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\cli.d.ts.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\cli.js
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\cli.js.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\inMemory.d.ts
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\inMemory.d.ts.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\inMemory.js
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\inMemory.js.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\package.json
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\types.d.ts
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\types.d.ts.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\types.js
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\types.js.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\client\index.d.ts
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\client\index.d.ts.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\client\index.js
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\client\index.js.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\client\sse.d.ts
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\client\sse.d.ts.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\client\sse.js
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\client\sse.js.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\client\stdio.d.ts
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\client\stdio.d.ts.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\client\stdio.js
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\client\stdio.js.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\client\websocket.d.ts
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\client\websocket.d.ts.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\client\websocket.js
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\client\websocket.js.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\server\completable.d.ts
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\server\completable.d.ts.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\server\completable.js
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\server\completable.js.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\server\index.d.ts
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\server\index.d.ts.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\server\index.js
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\server\index.js.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\server\mcp.d.ts
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\server\mcp.d.ts.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\server\mcp.js
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\server\mcp.js.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\server\sse.d.ts
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\server\sse.d.ts.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\server\sse.js
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\server\sse.js.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\server\stdio.d.ts
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\server\stdio.d.ts.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\server\stdio.js
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\server\stdio.js.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\shared\protocol.d.ts
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\shared\protocol.d.ts.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\shared\protocol.js
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\shared\protocol.js.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\shared\stdio.d.ts
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\shared\stdio.d.ts.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\shared\stdio.js
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\shared\stdio.js.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\shared\transport.d.ts
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\shared\transport.d.ts.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\shared\transport.js
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\shared\transport.js.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\shared\uriTemplate.d.ts
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\shared\uriTemplate.d.ts.map
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\shared\uriTemplate.js
mcp-duckduckresearch\node_modules\@modelcontextprotocol\sdk\dist\esm\shared\uriTemplate.js.map
```