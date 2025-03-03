#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  JSONRPCMessage,
  JSONRPCRequest,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { browserManager } from "./browser.js";
import { performSearch } from "./search.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { SearchArgsSchema, VisitPageArgsSchema } from "./types.js";

export class DuckDuckResearchServer {
  private server: Server;
  private transport: StdioServerTransport | null = null;
  private initialized: boolean = false;
  private pendingInitialization: Promise<void> | null = null;

  constructor() {
    console.log("[Server] Creating DuckDuckResearch Server");

    // Initialize server with base configuration
    this.server = new Server(
      {
        name: "mcp-duckduckresearch",
        version: "0.1.0",
      },
      {
        capabilities: {
          tools: {
            allowUnknownToolCalls: false,
          },
        },
      }
    );

    // Setup handlers before connecting transport
    this.setupHandlers();
  }

  private setupHandlers() {
    console.log("[Server] Setting up handlers");

    // Setup initialization promise
    this.pendingInitialization = new Promise((resolve) => {
      this.server.oninitialized = () => {
        console.log("[Server] Initialization complete");
        console.log("[Server] Client info:", this.server.getClientVersion());
        console.log("[Server] Client capabilities:", this.server.getClientCapabilities());
        this.initialized = true;
        resolve();
      };
    });

    // Handle tool listing requests
    this.server.setRequestHandler(ListToolsRequestSchema, async (request) => {
      console.log("[Handler] list_tools called");

      await this.ensureInitialized();
      
      const tools = [
        {
          name: "search_duckduckgo",
          description: "Search the web using DuckDuckGo",
          inputSchema: zodToJsonSchema(SearchArgsSchema) as any,
        },
        {
          name: "visit_page",
          description: "Visit a webpage and extract its content",
          inputSchema: VisitPageArgsSchema,
        },
        {
          name: "take_screenshot",
          description: "Take a screenshot of the current page",
          inputSchema: {
            type: "object",
            properties: {},
            required: [],
          },
        },
      ];

      console.log("[Handler] list_tools returning:", tools.map(t => t.name));
      return { tools };
    });

    // Handle tool execution requests
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      console.log("[Handler] Tool call received");

      await this.ensureInitialized();

      // Validate request parameters
      if (!request?.params?.name) {
        console.warn("[Handler] Rejecting tool call - missing parameters");
        throw new McpError(
          ErrorCode.InvalidRequest,
          "Missing request parameters"
        );
      }

      try {
        console.log(`[Handler] Executing tool: ${request.params.name}`);
        
        switch (request.params.name) {
          case "search_duckduckgo": {
            console.log("[Handler] Parsing search arguments");
            const searchArgs = SearchArgsSchema.parse(request.params.arguments);
            console.log("[Handler] Performing search:", searchArgs);
            const results = await performSearch(searchArgs);
            console.log("[Handler] Search completed, returning results");
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(results, null, 2),
                },
              ],
            };
          }

          case "visit_page": {
            console.log("[Handler] Parsing visit_page arguments");
            const { url } = VisitPageArgsSchema.parse(request.params.arguments);
            console.log("[Handler] Visiting page:", url);
            const page = await browserManager.ensureBrowser();
            await browserManager.safePageNavigation(page, url);
            const content = await browserManager.extractContentAsMarkdown(page);
            console.log("[Handler] Page visit completed, returning content");
            return {
              content: [
                {
                  type: "text",
                  text: content,
                },
              ],
            };
          }

          case "take_screenshot": {
            console.log("[Handler] Taking screenshot");
            const page = await browserManager.ensureBrowser();
            const screenshot = await browserManager.takeScreenshotWithSizeLimit(page);
            console.log("[Handler] Screenshot captured, returning data");
            return {
              content: [
                {
                  type: "image",
                  mediaType: "image/png",
                  data: screenshot,
                },
              ],
            };
          }

          default:
            console.warn(`[Handler] Unknown tool requested: ${request.params.name}`);
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${request.params.name}`
            );
        }
      } catch (error) {
        console.error("[Handler] Tool execution error:", error);
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${(error as Error).message}`
        );
      }
    });

    // Setup error handler
    this.server.onerror = (error: Error) => {
      console.error("[Server] Error:", error);
    };

    // Setup cleanup handler
    process.on("SIGINT", async () => {
      console.log("[Server] Received SIGINT");
      await this.cleanup();
      process.exit(0);
    });

    console.log("[Server] All handlers registered");
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized && this.pendingInitialization) {
      console.log("[Server] Waiting for initialization...");
      await this.pendingInitialization;
    }

    if (!this.initialized) {
      console.warn("[Server] Server not properly initialized");
      throw new McpError(
        ErrorCode.InvalidRequest,
        "Server not initialized"
      );
    }
  }

  async cleanup() {
    console.log("[Server] Starting cleanup");
    try {
      await browserManager.cleanup();
      if (this.transport) {
        // Clean up transport if needed
      }
    } catch (error) {
      console.error("[Server] Cleanup error:", error);
    }
    console.log("[Server] Cleanup complete");
  }

  async run() {
    console.log("[Server] Starting server");

    try {
      // Initialize transport
      this.transport = new StdioServerTransport();

      // Set up message logging
      this.transport.onmessage = (message: JSONRPCMessage) => {
        console.log("[Transport] Message received:", typeof message === 'object' ? JSON.stringify(message, null, 2) : message);

        if (message && typeof message === 'object' && 'method' in message) {
          console.log("[Transport] Method call:", (message as JSONRPCRequest).method);
        }
      };

      // Connect transport to server
      console.log("[Server] Connecting transport");
      await this.server.connect(this.transport);
      console.log("[Server] Transport connected successfully");

      // Wait for initialization to complete or timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Server initialization timeout")), 30000);
      });

      await Promise.race([this.pendingInitialization, timeoutPromise]).catch((error) => {
        console.error("[Server] Failed to initialize:", error);
        throw error;
      });

      console.log("[Server] Ready to handle requests");
    } catch (error) {
      console.error("[Server] Failed to start:", error);
      throw error;
    }
  }

  getServer(): Server {
    return this.server;
  }
}

// Start server if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("[Main] Starting DuckDuckResearch Server");
  const server = new DuckDuckResearchServer();
  server.run().catch((error) => {
    console.error("[Main] Failed to start server:", error);
    process.exit(1);
  });
}
