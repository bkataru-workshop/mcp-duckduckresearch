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
import { zodToJsonSchema } from "zod-to-json-schema";
import { SearchArgsSchema, VisitPageArgsSchema } from "./types.js";

import { McpError } from "@modelcontextprotocol/sdk/types.js";

export class DuckDuckResearchServer {
  private server: Server;

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
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async (_request) => ({
      tools: [
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
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      console.log("CallToolRequestSchema handler started", request?.params?.name, request?.params?.arguments);

      if (!request?.params) {
        console.error("CallToolRequestSchema: request params are undefined");
        throw new McpError(ErrorCode.InvalidRequest, "Request params are undefined");
      }

      if (!request.params.name) {
        console.error("CallToolRequestSchema: request params name is undefined");
        throw new McpError(ErrorCode.InvalidRequest, "Request params name is undefined");
      }

      try {
        switch (request.params.name) {
          case "search_duckduckgo": {
            console.log("search_duckduckgo: handler started");
            console.log("search_duckduckgo: parsing arguments", request.params.arguments);
            const searchArgs = SearchArgsSchema.parse(request.params.arguments);
            console.log("search_duckduckgo: arguments parsed", searchArgs);
            if (!searchArgs) {
              throw new McpError(ErrorCode.InvalidParams, "Missing required parameters");
            }

            console.log("search_duckduckgo: calling performSearch", searchArgs);
            const response = await performSearch(searchArgs);
            console.log("search_duckduckgo: performSearch returned", response);
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
            console.log("visit_page: handler started");
            console.log("visit_page: parsing arguments", request.params.arguments);
            const { url } = VisitPageArgsSchema.parse(request.params.arguments);
            console.log("visit_page: arguments parsed", url);
            console.log("visit_page: calling browserManager.ensureBrowser");
            const page = await browserManager.ensureBrowser();
            console.log("visit_page: browserManager.ensureBrowser returned");
            console.log("visit_page: calling browserManager.safePageNavigation", url);
            await browserManager.safePageNavigation(page, url);
            console.log("visit_page: browserManager.safePageNavigation returned");
            console.log("visit_page: calling browserManager.extractContentAsMarkdown");
            const content = await browserManager.extractContentAsMarkdown(page);
            console.log("visit_page: browserManager.extractContentAsMarkdown returned", content);

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
            console.log("take_screenshot: handler started");
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

          default: {
            console.log("call_tool: unknown tool", request.params.name);
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
          }
        }
      } catch (error) {
        console.error("call_tool: error", error);
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

  private setupErrorHandling() {
    this.server.onerror = (error: Error) => {
      console.error("[MCP Error]", error);
    };

    process.on("SIGINT", async () => {
      await this.cleanup();
      process.exit(0);
    });
  }

  async cleanup() {
    await browserManager.cleanup();
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("DuckDuckResearch MCP server running on stdio");
  }

  getServer(): Server {
    return this.server;
  }
}
