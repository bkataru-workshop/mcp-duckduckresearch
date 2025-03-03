import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import {
  type JSONRPCMessage,
  type JSONRPCRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { DuckDuckResearchServer } from "../../src/index.js";

interface MessageHandler {
  (message: JSONRPCMessage): void;
}

class TestTransport {
  private callback?: MessageHandler;
  private connected = false;
  private pair?: TestTransport & { adapter?: TransportAdapter };
  adapter?: TransportAdapter;

  constructor() {
    this.connected = false;
  }

  handleMessage(callback: MessageHandler): void {
    console.log("TestTransport.handleMessage: setting callback");
    this.callback = callback;
  }

  processMessage(message: JSONRPCMessage): void {
    console.log("TestTransport.processMessage:", message);
    if (this.callback) {
      this.callback(message);
    } else {
      console.warn("TestTransport.processMessage: no callback registered");
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
    try {
      await this.pair.adapter.onmessage(message);
      console.log("TestTransport.sendMessage: message delivered successfully");
    } catch (error) {
      console.error("TestTransport.sendMessage: error delivering message", error);
      throw error;
    }
  }

  async initialize(): Promise<void> {
    console.log("TestTransport.initialize: initializing");
    if (this.connected) {
      console.warn("TestTransport.initialize: already connected");
      return Promise.resolve();
    }
    this.connected = true;
    console.log("TestTransport.initialize: initialized");
    return Promise.resolve();
  }

  async shutdown(): Promise<void> {
    console.log("TestTransport.shutdown: starting");
    this.connected = false;
    this.callback = undefined;
    this.pair = undefined;
    this.adapter = undefined;
    console.log("TestTransport.shutdown: complete");
    return Promise.resolve();
  }

  link(transport: TestTransport & { adapter?: TransportAdapter }): void {
    console.log("TestTransport.link: linking transport");
    this.pair = transport;
  }
}

class TransportAdapter implements Transport {
  private handler?: ((message: JSONRPCMessage) => void);
  private testTransport: TestTransport & { adapter?: TransportAdapter };

  constructor(testTransport: TestTransport) {
    console.log("TransportAdapter.constructor: creating adapter");
    this.testTransport = testTransport;
    this.testTransport.adapter = this;
  }

  async onmessage(message: JSONRPCMessage): Promise<void> {
    console.log("TransportAdapter.onmessage: received message", message);
    if (this.handler) {
      console.log("TransportAdapter.onmessage: forwarding to handler");
      this.handler(message);
    } else {
      console.warn("TransportAdapter.onmessage: no handler registered");
    }
  }

  set underlyingOnMessage(handler: ((message: JSONRPCMessage) => void) | undefined) {
    console.log("TransportAdapter.underlyingOnMessage: setting handler", handler ? "defined" : "undefined");
    this.handler = handler;
  }

  async send(message: JSONRPCMessage): Promise<void> {
    console.log("TransportAdapter.send: sending message", message);
    try {
      await this.testTransport.sendMessage(message);
      console.log("TransportAdapter.send: message sent successfully");
    } catch (error) {
      console.error("TransportAdapter.send: error sending message", error);
      throw error;
    }
  }

  async start(): Promise<void> {
    console.log("TransportAdapter.start: starting");
    await this.testTransport.initialize();
    console.log("TransportAdapter.start: complete");
    return Promise.resolve();
  }

  async close(): Promise<void> {
    console.log("TransportAdapter.close: closing");
    await this.testTransport.shutdown();
    console.log("TransportAdapter.close: complete");
    return Promise.resolve();
  }
}

describe("DuckDuckResearch Server - Tool Listing", () => {
  let server: DuckDuckResearchServer;
  let transport: TestTransport;

  beforeEach(async () => {
    console.log("\n=== Test Setup Starting ===\n");
    
    server = new DuckDuckResearchServer();
    const mcpServer = server.getServer();

    console.log("Creating test transports...");
    const clientTransport = new TestTransport();
    const serverTransport = new TestTransport();

    console.log("Linking transports...");
    clientTransport.link(serverTransport);
    serverTransport.link(clientTransport);

    console.log("Creating transport adapters...");
    const serverAdapter = new TransportAdapter(serverTransport);
    const clientAdapter = new TransportAdapter(clientTransport);

    console.log("Initializing transports...");
    await Promise.all([
      clientTransport.initialize(),
      serverTransport.initialize()
    ]);

    console.log("Connecting server...");
    await mcpServer.connect(serverAdapter);

    console.log("Verifying server connection...");
    if (!(mcpServer as any)._transport) {
      throw new Error("Server failed to establish transport connection");
    }

    // Set transport before initialization
    transport = clientTransport;

    // Send initialization sequence
    console.log("Sending initialization sequence...");
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
    console.log("Sending initialized notification...");
    await clientTransport.sendMessage({
      jsonrpc: "2.0",
      method: "initialized",
      params: {}
    });

    // Wait for initialization response
    if (!('result' in initResponse)) {
      throw new Error('Failed to initialize server');
    }

    // Wait a bit for initialization to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    console.log("\n=== Test Setup Complete ===\n");
  });

  afterEach(async () => {
    console.log("\n=== Test Cleanup Starting ===\n");
    await server.cleanup();
    console.log("\n=== Test Cleanup Complete ===\n");
  });

  async function sendRequest<T = unknown>(request: JSONRPCRequest): Promise<JSONRPCMessage & { result?: T }> {
    console.log("\n=== Sending Request ===\n", request);
    
    return new Promise<JSONRPCMessage & { result?: T }>((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.error("\n=== Request Timeout ===\n");
        transport.handleMessage(() => {});
        reject(new Error('Request timed out'));
      }, 30000);

      const responseHandler = (response: JSONRPCMessage) => {
        console.log("\n=== Received Response ===\n", response);
        if ('id' in response && response.id === request.id) {
          clearTimeout(timeout);
          transport.handleMessage(() => {});
          if ('error' in response) {
            console.error("Error response received:", response.error);
          }
          resolve(response as JSONRPCMessage & { result?: T });
        } else {
          console.log("Ignoring non-matching response");
        }
      };

      transport.handleMessage(responseHandler);
      console.log("Sending request to transport...");
      
      transport.sendMessage(request).catch((error: Error) => {
        console.error("Failed to send request:", error);
        clearTimeout(timeout);
        transport.handleMessage(() => {});
        reject(error);
      });
    });
  }

  it("should list available tools", async () => {
    console.log("\n=== Test Case: List Available Tools ===\n");
    
    const request: JSONRPCRequest = {
      jsonrpc: "2.0",
      id: "1",
      method: "list_tools",
      params: {},
    };

    console.log("Sending list_tools request");
    const response = await sendRequest<{
      tools: Array<{ name: string; description: string; inputSchema: unknown }>;
    }>(request);

    console.log("Verifying response");
    if (!('result' in response) || !response.result) {
      throw new Error('Expected result in response');
    }
    expect(response.result.tools).toHaveLength(3);
    expect(response.result.tools.map(t => t.name)).toEqual([
      "search_duckduckgo",
      "visit_page",
      "take_screenshot",
    ]);
  });
});
