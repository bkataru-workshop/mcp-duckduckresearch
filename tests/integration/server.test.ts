import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import {
  CallToolRequestSchema,
  CallToolResultSchema,
  ErrorCode,
  type JSONRPCMessage,
  type JSONRPCRequest,
  ListToolsRequestSchema,
  ListToolsResultSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { SafeSearchType } from "duck-duck-scrape";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { browserManager } from "../../src/browser.js";
import { DuckDuckResearchServer } from "../../src/index.js";
import { performSearch } from "../../src/search.js";
import type { SearchResponse } from "../../src/types.js";

// Mock dependencies
vi.mock("../../src/search.js", () => ({
  performSearch: vi.fn(),
}));

vi.mock("../../src/browser.js", () => ({
  browserManager: {
    ensureBrowser: vi.fn().mockResolvedValue({}),
    safePageNavigation: vi.fn().mockResolvedValue(undefined),
    extractContentAsMarkdown: vi.fn().mockResolvedValue("Test Content"),
    takeScreenshotWithSizeLimit: vi.fn().mockResolvedValue("test-screenshot"),
    cleanup: vi.fn().mockResolvedValue(undefined),
  },
}));

interface MessageHandler {
  (message: JSONRPCMessage): void;
}

// Base test transport implementation
class TestTransport {
  private callback?: MessageHandler;
  private connected = false;
  private pair?: TestTransport & { adapter?: TransportAdapter }; // Add adapter property
  adapter?: TransportAdapter; // Add adapter property

  constructor() {
    this.connected = false;
  }

  handleMessage(callback: MessageHandler): void {
    this.callback = callback;
  }

  processMessage(message: JSONRPCMessage): void {
    if (this.callback) {
      this.callback(message);
    }
  }

  async sendMessage(message: JSONRPCMessage): Promise<void> {
    if (!this.connected) {
      throw new Error('Transport not connected');
    }

    if (this.pair && this.pair.adapter && this.pair.adapter.onmessage) { // Use adapter.onmessage
      this.pair.adapter.onmessage(message);
    }
  }

  async initialize(): Promise<void> {
    this.connected = true;
  }

  async shutdown(): Promise<void> {
    this.connected = false;
    this.callback = undefined;
    this.pair = undefined;
    this.adapter = undefined; // Clear adapter on shutdown
  }

  link(transport: TestTransport & { adapter?: TransportAdapter }): void { // Update link type
    this.pair = transport;
  }
}

// Transport adapter that matches the MCP SDK interface
class TransportAdapter implements Transport {
  private handler?:  ((message: JSONRPCMessage) => void);
  private testTransport: TestTransport & { adapter?: TransportAdapter }; // Add adapter property

  constructor(testTransport: TestTransport) {
    this.testTransport = testTransport;
    this.testTransport.adapter = this; // Set adapter property on TestTransport
   }

  onmessage = (message: JSONRPCMessage) => {
    if (this.handler) {
      this.handler(message);
    }
  };

  set underlyingOnMessage(handler:   ((message: JSONRPCMessage) => void) | undefined) {
    this.handler = handler;
  }

  async send(message: JSONRPCMessage): Promise<void> {
    await this.testTransport.sendMessage(message);
  }

  async start(): Promise<void> {
    return this.testTransport.initialize();
  }

  async close(): Promise<void> {
    return this.testTransport.shutdown();
  }
}

describe("DuckDuckResearch Server", () => {
  let server: DuckDuckResearchServer;
  let transport: TestTransport;

  beforeEach(async () => {
    server = new DuckDuckResearchServer();
    const mcpServer = server.getServer();

    // Initialize test transports
    const clientTransport = new TestTransport();
    const serverTransport = new TestTransport();

    // Set up bidirectional communication
    clientTransport.link(serverTransport);
    serverTransport.link(clientTransport);

    // Create adapter for server transport
    const serverAdapter = new TransportAdapter(serverTransport);
    const clientAdapter = new TransportAdapter(clientTransport); // Create client adapter

    // Start transports and connect server
    await Promise.all([
      clientTransport.initialize(),
      serverTransport.initialize(),
    ]);

    serverTransport.adapter = serverAdapter; // Set adapter on server transport
    clientTransport.adapter = clientAdapter; // Set adapter on client transport
    mcpServer.connect(serverAdapter);
    transport = clientTransport;
  });

  afterEach(async () => {
    await server.cleanup();
  });

  async function sendRequest<T = unknown>(request: JSONRPCRequest): Promise<JSONRPCMessage & { result?: T }> {
    return new Promise<JSONRPCMessage & { result?: T }>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Request timed out'));
      }, 5000);

      const responseHandler = (response: JSONRPCMessage) => {
        if ('id' in response && response.id === request.id) {
          clearTimeout(timeout);
          transport.handleMessage(() => {});
          resolve(response as JSONRPCMessage & { result?: T });
        }
      };

      transport.handleMessage(responseHandler);
      transport.sendMessage(request).catch((error: Error) => {
        clearTimeout(timeout);
        transport.handleMessage(() => {});
        reject(error);
      });
    });
  }

  interface ListToolsResult {
    tools: Array<{ name: string; description: string; inputSchema: unknown }>;
  }

  interface ToolResult {
    content: Array<{
      type: string;
      text?: string;
      data?: string;
      mediaType?: string;
    }>;
  }

  describe("Tool listing", () => {
    it("should list available tools", async () => {
      const request: JSONRPCRequest = {
        jsonrpc: "2.0",
        id: "1",
        method: "list_tools",
        params: {},
      };

      const response = await sendRequest<ListToolsResult>(request);
      if (!('result' in response) || !response.result) {
        throw new Error('Expected result in response');
      }
      expect(response.result.tools).toHaveLength(3);
      expect(response.result.tools.map((t) => t.name)).toEqual([
        "search_duckduckgo",
        "visit_page",
        "take_screenshot",
      ]);
    });
  });

  describe("Search tool", () => {
    it("should perform search with valid parameters", async () => {
      const mockSearchResult = { results: [{ title: "Test", url: "https://test.com" }] };
      (performSearch as Mock).mockResolvedValueOnce(mockSearchResult);

      const request: JSONRPCRequest = {
        jsonrpc: "2.0",
        id: "2",
        method: "call_tool",
        params: {
          name: "search_duckduckgo",
          arguments: {
            query: "test query",
            region: "us-en",
            safeSearch: "MODERATE",
          },
        },
      };

      const response = await sendRequest<ToolResult>(request);
      if (!('result' in response) || !response.result) {
        throw new Error('Expected result in response');
      }
      expect(JSON.parse(response.result.content[0].text as string)).toEqual(mockSearchResult);
      expect(performSearch).toHaveBeenCalledWith(expect.objectContaining({
        query: "test query",
      }));
    });

    it("should handle invalid search parameters", async () => {
      const request: JSONRPCRequest = {
        jsonrpc: "2.0",
        id: "3",
        method: "call_tool",
        params: {
          name: "search_duckduckgo",
          arguments: {
            // Missing required query parameter
            region: "us-en",
          },
        },
      };

      const response = await sendRequest<ToolResult>(request);
      expect('error' in response).toBe(true);
      if ('error' in response) {
        expect(response.error.code).toBe(ErrorCode.InvalidParams);
      }
    });
  });

  describe("Visit page tool", () => {
    it("should visit page and extract content", async () => {
      const mockContent = "# Test Content\n\nSome markdown content";
      (browserManager.extractContentAsMarkdown as Mock).mockResolvedValueOnce(mockContent);

      const request: JSONRPCRequest = {
        jsonrpc: "2.0",
        id: "4",
        method: "call_tool",
        params: {
          name: "visit_page",
          arguments: {
            url: "https://example.com",
          },
        },
      };

      const response = await sendRequest<ToolResult>(request);
      if (!('result' in response) || !response.result) {
        throw new Error('Expected result in response');
      }
      expect(browserManager.safePageNavigation).toHaveBeenCalledWith(
        expect.anything(),
        "https://example.com"
      );
      expect(response.result.content[0]).toEqual({
        type: "text",
        text: mockContent,
      });
    });

    it("should handle invalid URLs", async () => {
      const request: JSONRPCRequest = {
        jsonrpc: "2.0",
        id: "5",
        method: "call_tool",
        params: {
          name: "visit_page",
          arguments: {
            url: "not-a-valid-url",
          },
        },
      };

      const response = await sendRequest<ToolResult>(request);
      expect('error' in response).toBe(true);
    });
  });

  describe("Take screenshot tool", () => {
    it("should take screenshot of current page", async () => {
      const mockScreenshot = "base64-encoded-image";
      (browserManager.takeScreenshotWithSizeLimit as Mock).mockResolvedValueOnce(mockScreenshot);

      const request: JSONRPCRequest = {
        jsonrpc: "2.0",
        id: "6",
        method: "call_tool",
        params: {
          name: "take_screenshot",
          arguments: {},
        },
      };

      const response = await sendRequest<ToolResult>(request);
      if (!('result' in response) || !response.result) {
        throw new Error('Expected result in response');
      }
      expect(response.result.content[0]).toEqual({
        type: "image",
        mediaType: "image/png",
        data: mockScreenshot,
      });
    });
  });

  describe("Error handling", () => {
    it("should handle unknown tool requests", async () => {
      const request: JSONRPCRequest = {
        jsonrpc: "2.0",
        id: "7",
        method: "call_tool",
        params: {
          name: "nonexistent_tool",
          arguments: {},
        },
      };

      const response = await sendRequest(request);
      expect('error' in response).toBe(true);
      if ('error' in response) {
        expect(response.error.code).toBe(ErrorCode.MethodNotFound);
      }
    });
  });
});
