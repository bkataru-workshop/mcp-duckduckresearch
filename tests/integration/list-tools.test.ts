import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import {
  type JSONRPCMessage,
  type JSONRPCRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { DuckDuckResearchServer } from "../../src/index.js";

// Base test transport implementation (same as in server.test.ts)
class TestTransport {
  private callback?: MessageHandler;
  private connected = false;
  private pair?: TestTransport & { adapter?: TransportAdapter };
  adapter?: TransportAdapter;

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

    if (this.pair && this.pair.adapter && this.pair.adapter.onmessage) {
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
    this.adapter = undefined;
  }

  link(transport: TestTransport & { adapter?: TransportAdapter }): void {
    this.pair = transport;
  }
}

// Transport adapter that matches MCP SDK interface (same as in server.test.ts)
class TransportAdapter implements Transport {
  private handler?:  ((message: JSONRPCMessage) => void);
  private testTransport: TestTransport & { adapter?: TransportAdapter };

  constructor(testTransport: TestTransport) {
    this.testTransport = testTransport;
    this.testTransport.adapter = this;
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

interface MessageHandler {
  (message: JSONRPCMessage): void;
}

describe("DuckDuckResearch Server - Tool Listing", () => {
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
    const clientAdapter = new TransportAdapter(clientTransport);

    // Start transports and connect server
    await Promise.all([
      clientTransport.initialize(),
      serverTransport.initialize(),
    ]);

    serverTransport.adapter = serverAdapter;
    clientTransport.adapter = clientAdapter;
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
      }, 30000);

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
