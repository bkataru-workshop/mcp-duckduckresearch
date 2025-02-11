#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  CallToolResultSchema,
  ErrorCode,
  JSONRPCRequest,
  ListToolsRequestSchema,
  ListToolsResultSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { browserManager } from "./browser.js";
import { performSearch } from "./search.js";
import { SearchArgsSchema, VisitPageArgsSchema } from "./types.js";

import { McpError } from "@modelcontextprotocol/sdk/types.js";

/**
 * MCP Server implementation that provides DuckDuckGo search and web page interaction capabilities.
 * Implements three main tools:
 * - search_duckduckgo: Search using DuckDuckGo
 * - visit_page: Visit and extract content from a webpage
 * - take_screenshot: Take a screenshot of the current page
 *
 * @example
 * ```typescript
 * const server = new DuckDuckResearchServer();
 * await server.run();
 * ```
 */
export class DuckDuckResearchServer {
  private server: Server;

  /**
   * Initializes a new DuckDuckResearch server instance.
   * Sets up tool handlers and error handling.
   */
  constructor() {
    this.server = new Server(
      {
        name: "mcp-duckduckresearch",
        version: "0.1.0",
      },
      {
        capabilities: {
          tools: {},
        },
        // 15 second timeout for requests
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  /**
   * Sets up handlers for the server's tools.
   * Registers tool schemas and implements their execution logic.
   *
   * @private
   */
  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async (_request) => ({
      tools: [
        {
          name: "search_duckduckgo",
          description: "Search the web using DuckDuckGo",
          inputSchema: SearchArgsSchema,
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
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      console.log("CallToolRequestSchema handler started", request?.params?.name);
      try {
        switch (request.params.name) {
          case "search_duckduckgo": {
            console.log("search_duckduckgo: parsing arguments");
            const searchArgs = SearchArgsSchema.parse(request.params.arguments);
            console.log("search_duckduckgo: arguments parsed");
            if (!searchArgs) {
              throw new McpError(ErrorCode.InvalidParams, "Missing required parameters");
            }

            console.log("search_duckduckgo: calling performSearch");
            const response = await performSearch(searchArgs);
            console.log("search_duckduckgo: performSearch returned");
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(response, null, 2),
                },
              ],
            };
          }

          case "visit_page": {
            console.log("visit_page: parsing arguments");
            const { url } = VisitPageArgsSchema.parse(request.params.arguments);
            console.log("visit_page: arguments parsed");
            console.log("visit_page: calling browserManager.ensureBrowser");
            const page = await browserManager.ensureBrowser();
            console.log("visit_page: browserManager.ensureBrowser returned");
            console.log("visit_page: calling browserManager.safePageNavigation");
            await browserManager.safePageNavigation(page, url);
            console.log("visit_page: browserManager.safePageNavigation returned");
            console.log("visit_page: calling browserManager.extractContentAsMarkdown");
            const content = await browserManager.extractContentAsMarkdown(page);
            console.log("visit_page: browserManager.extractContentAsMarkdown returned");

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
            console.log("take_screenshot: calling browserManager.ensureBrowser");
            const page = await browserManager.ensureBrowser();
            console.log("take_screenshot: browserManager.ensureBrowser returned");
            console.log("take_screenshot: calling browserManager.takeScreenshotWithSizeLimit");
            const screenshot = await browserManager.takeScreenshotWithSizeLimit(page);
            console.log("take_screenshot: browserManager.takeScreenshotWithSizeLimit returned");

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
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${(error as Error).message}`
        );
      }
    });
  }

  /**
   * Sets up error handling for the server.
   * Configures error logging and cleanup on process termination.
   *
   * @private
   */
  private setupErrorHandling() {
    this.server.onerror = (error: Error) => {
      console.error("[MCP Error]", error);
    };

    process.on("SIGINT", async () => {
      await this.cleanup();
      process.exit(0);
    });
  }

  /**
   * Cleans up server resources, including browser instances.
   * Should be called before server shutdown.
   */
  async cleanup() {
    await browserManager.cleanup();
  }

  /**
   * Starts the server with stdio transport.
   *
   * @returns Promise that resolves when the server is running
   *
   * @example
   * ```typescript
   * const server = new DuckDuckResearchServer();
   * await server.run();
   * ```
   */
  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("DuckDuckResearch MCP server running on stdio");
  }

  /**
   * Gets the underlying MCP server instance.
   * Primarily used for testing.
   *
   * @returns The MCP server instance
   */
  getServer(): Server {
    return this.server;
  }
}

// Only start the server if this is the main module
if (require.main === module) {
  const server = new DuckDuckResearchServer();
  server.run().catch(console.error);
}
