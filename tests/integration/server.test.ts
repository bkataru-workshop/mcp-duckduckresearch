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
    console.log("TestTransport.sendMessage: sending message", message);
    if (!this.connected) {
      console.error("TestTransport.sendMessage: transport not connected");
      throw new Error('Transport not connected');
    }

    if (!this.pair) {
      console.error("TestTransport.sendMessage: no paired transport");
      throw new Error('No paired transport');
    }

    if (!this.pair.adapter) {
      console.error("TestTransport.sendMessage: no adapter on paired transport");
      throw new Error('No adapter on paired transport');
    }

    if (!this.pair.adapter.onmessage) {
      console.error("TestTransport.sendMessage: no onmessage handler on paired adapter");
      throw new Error('No onmessage handler on paired adapter');
    }

    console.log("TestTransport.sendMessage: calling onmessage on paired adapter");
    await new Promise<void>((resolve) => {
      this.pair!.adapter!.onmessage(message);
      resolve();
    });
    console.log("TestTransport.sendMessage: message delivered");
  }

  async initialize(): Promise<void> {
    console.log("TestTransport.initialize: initializing");
    if (this.connected) {
      console.warn("TestTransport.initialize: already connected");
      return;
    }
    this.connected = true;
    console.log("TestTransport.initialize: initialized");
  }

  async shutdown(): Promise<void> {
    console.log("TestTransport.shutdown: shutting down");
    this.connected = false;
    this.callback = undefined;
    this.pair = undefined;
    this.adapter = undefined; // Clear adapter on shutdown
    console.log("TestTransport.shutdown: shutdown finished");
  }

  link(transport: TestTransport & { adapter?: TransportAdapter }): void { // Update link type
    this.pair = transport;
  }
}

// Transport adapter that matches the MCP SDK interface
class TransportAdapter implements Transport {
  private handler?: ((message: JSONRPCMessage) => void);
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

  set underlyingOnMessage(handler: ((message: JSONRPCMessage) => void) | undefined) {
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
    console.log("Test setup: starting");
    server = new DuckDuckResearchServer();
    const mcpServer = server.getServer();

    console.log("Test setup: creating transports");
    const clientTransport = new TestTransport();
    const serverTransport = new TestTransport();

    console.log("Test setup: linking transports");
    clientTransport.link(serverTransport);
    serverTransport.link(clientTransport);

    console.log("Test setup: creating transport adapters");
    const serverAdapter = new TransportAdapter(serverTransport);
    const clientAdapter = new TransportAdapter(clientTransport);

    console.log("Test setup: initializing transports");
    await clientTransport.initialize();
    await serverTransport.initialize();

    console.log("Test setup: connecting server");
    await mcpServer.connect(serverAdapter);
    
    console.log("Test setup: verifying connection");
    if (!(mcpServer as any)._transport) {
      throw new Error("Server failed to establish transport connection");
    }

    // Set transport first
    transport = clientTransport;

    // Send initialization sequence
    console.log("Test setup: sending initialization sequence");
    const initResponse = await sendRequest({
      jsonrpc: "2.0",
      id: "init",
      method: "initialize",
      params: {
        protocolVersion: "1.0",
        clientInfo: {
          name: "test-client",
          version: "1.0.0"
        },
        capabilities: {
          tools: {
            listTools: true,
            callTools: true
          }
        }
      }
    });

    // Send initialized notification
    console.log("Test setup: sending initialized notification");
    await clientTransport.sendMessage({
      jsonrpc: "2.0",
      method: "initialized",
      params: {}
    });

    // Wait for initialization response
    if (!('result' in initResponse)) {
      throw new Error('Failed to initialize server');
    }

    console.log("Test setup: initialization successful");

    // Wait a bit for initialization to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    console.log("Test setup: complete");
  });

  afterEach(async () => {
    await server.cleanup();
  });

  async function sendRequest<T = unknown>(request: JSONRPCRequest): Promise<JSONRPCMessage & { result?: T }> {
    console.log("sendRequest: starting", request);
    return new Promise<JSONRPCMessage & { result?: T }>((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.error("sendRequest: request timed out");
        transport.handleMessage(() => {});
        reject(new Error('Request timed out'));
      }, 30000);

      const responseHandler = (response: JSONRPCMessage) => {
        console.log("sendRequest: received response", response);
        if ('id' in response && response.id === request.id) {
          clearTimeout(timeout);
          transport.handleMessage(() => {});
          if ('error' in response) {
            console.error("sendRequest: received error response", response.error);
          }
          resolve(response as JSONRPCMessage & { result?: T });
        } else {
          console.log("sendRequest: ignoring non-matching response");
        }
      };

      transport.handleMessage(responseHandler);
      console.log("sendRequest: sending request");
      transport.sendMessage(request).catch((error: Error) => {
        console.error("sendRequest: failed to send request", error);
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
      expect(response.result.content[0].text).toBeDefined();
      const searchResult = JSON.parse(response.result.content[0].text as string);
      expect(searchResult.results).toBeInstanceOf(Array);
      expect(searchResult.metadata).toBeDefined();
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
      expect(response.result.content[0].type).toBe("text");
      expect(response.result.content[0].text).toBeDefined();
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
      expect(response.result.content[0].type).toBe("image");
      expect(response.result.content[0].data).toBeDefined();
      expect(response.result.content[0].mediaType).toBe("image/png");
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
