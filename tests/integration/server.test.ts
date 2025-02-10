import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { DuckDuckResearchServer } from "../../src/index.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { performSearch } from "../../src/search.js";
import { 
  RequestSchema,
  ListToolsRequestSchema,
  ListToolsResultSchema,
  CallToolRequestSchema,
  CallToolResultSchema,
  JSONRPC_VERSION
} from "@modelcontextprotocol/sdk/types.js";
import { browserManager } from "../../src/browser.js";
import { SearchResponse } from "../../src/types.js";
import { SafeSearchType } from "duck-duck-scrape";

// Mock dependencies
vi.mock("../../src/search.js", () => ({
  performSearch: vi.fn(),
}));

vi.mock("../../src/browser.js", () => ({
  browserManager: {
    ensureBrowser: vi.fn(),
    safePageNavigation: vi.fn(),
    extractContentAsMarkdown: vi.fn(),
    takeScreenshotWithSizeLimit: vi.fn(),
    cleanup: vi.fn(),
  },
}));

describe("DuckDuckResearchServer Integration", () => {
  let server: DuckDuckResearchServer;

  beforeEach(() => {
    server = new DuckDuckResearchServer();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Server Initialization", () => {
    it("should initialize with correct configuration", () => {
      const mcpServer = server.getServer();
      expect(mcpServer).toBeInstanceOf(Server);
    });
  });

  describe("Tool Registration", () => {
    it("should register all required tools", async () => {
      const toolsRequest = {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
      };

      const mcpServer = server.getServer();
      const response = await mcpServer.request(toolsRequest, ListToolsResultSchema);
      const tools = response.tools;

      expect(tools).toHaveLength(3);
      expect(tools.map((t: any) => t.name)).toEqual([
        "search_duckduckgo",
        "visit_page",
        "take_screenshot",
      ]);
    });
  });

  describe("Tool Execution", () => {
    const mockSearchResults: SearchResponse = {
      type: "search_results",
      data: [
        {
          title: "Test Result",
          url: "https://example.com",
          description: "A test result",
          metadata: {
            type: "article",
            source: "example.com",
          },
        },
      ],
      metadata: {
        query: "test",
        timestamp: new Date().toISOString(),
        resultCount: 1,
        searchContext: {
          region: "zh-cn",
          safeSearch: SafeSearchType.MODERATE,
          numResults: 50,
        },
        queryAnalysis: {
          language: "en",
          topics: ["technology"],
        },
      },
    };

    const mockContent = "# Test Content\n\nThis is test content.";
    const mockScreenshot = Buffer.from("test-screenshot").toString("base64");

    beforeEach(() => {
      vi.mocked(performSearch).mockResolvedValue(mockSearchResults);
      vi.mocked(browserManager.ensureBrowser).mockResolvedValue({} as any);
      vi.mocked(browserManager.extractContentAsMarkdown).mockResolvedValue(mockContent);
      vi.mocked(browserManager.takeScreenshotWithSizeLimit).mockResolvedValue(mockScreenshot);
    });

    it("should execute search_duckduckgo tool", async () => {
      const request = {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "search_duckduckgo",
          arguments: {
            query: "test query",
          },
        },
      };

      const mcpServer = server.getServer();
      const response = await mcpServer.request(request, CallToolResultSchema);
      expect(response.content[0].text).toContain("Test Result");
      expect(performSearch).toHaveBeenCalledWith({ query: "test query" });
    });

    it("should execute visit_page tool", async () => {
      const request = {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "visit_page",
          arguments: {
            url: "https://example.com",
          },
        },
      };

      const mcpServer = server.getServer();
      const response = await mcpServer.request(request, CallToolResultSchema);
      expect(response.content[0].text).toBe(mockContent);
      expect(browserManager.safePageNavigation).toHaveBeenCalledWith(
        expect.anything(),
        "https://example.com"
      );
    });

    it("should execute take_screenshot tool", async () => {
      const mcpServer = server.getServer();
      const request = {
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: {
          name: "take_screenshot",
          arguments: {}
        },
      };

      const response = await mcpServer.request(request, CallToolResultSchema);
      expect(response.content[0].type).toBe("image");
      expect(browserManager.takeScreenshotWithSizeLimit).toHaveBeenCalled();
      expect(response.content[0].data).toBe(mockScreenshot);
    });
  });

  describe("Error Handling", () => {
    it("should handle unknown tool requests", async () => {
      const mcpServer = server.getServer();
      const request = {
        jsonrpc: "2.0",
        id: 5,
        method: "tools/call",
        params: {
          name: "nonexistent_tool",
          arguments: {},
        },
      };

      await expect(
        mcpServer.request(request, CallToolResultSchema)
      ).rejects.toThrow("Unknown tool");
    });

    it("should handle invalid tool arguments", async () => {
      const mcpServer = server.getServer();
      const request = {
        jsonrpc: "2.0",
        id: 6,
        method: "tools/call",
        params: {
          name: "visit_page",
          arguments: {
            url: "not-a-valid-url",
          },
        },
      };

      await expect(
        mcpServer.request(request, CallToolResultSchema)
      ).rejects.toThrow("Invalid");
    });

    it("should handle tool execution failures", async () => {
      vi.mocked(browserManager.ensureBrowser).mockRejectedValue(
        new Error("Browser failed to launch")
      );

      const mcpServer = server.getServer();

      const request = {
        jsonrpc: "2.0",
        id: 7,
        method: "tools/call",
        params: {
          name: "take_screenshot",
          arguments: {}
        },
      };
      await expect(
        mcpServer.request(request, CallToolResultSchema)
      ).rejects.toThrow("Browser failed to launch");
    });
  });

  describe("Complete Workflow", () => {
    it("should handle a complete search and visit workflow", async () => {
      // 1. Search for content
      const searchRequest = {
        jsonrpc: "2.0",
        id: 8,
        method: "tools/call",
        params: {
          name: "search_duckduckgo",
          arguments: {
            query: "test query",
          },
        },
      };

      const mcpServer = server.getServer();
      const searchResponse = await mcpServer.request(searchRequest, CallToolResultSchema);
      expect(searchResponse).toBeDefined();

      // 2. Visit first result
      const visitRequest = {
        jsonrpc: "2.0",
        id: 9,
        method: "tools/call",
        params: {
          name: "visit_page",
          arguments: {
            url: "https://example.com",
            takeScreenshot: true,
          },
        },
      };

      const visitResponse = await mcpServer.request(visitRequest, CallToolResultSchema);
      expect(visitResponse).toBeDefined();

      // 3. Take screenshot
      const screenshotRequest = {
        jsonrpc: "2.0",
        id: 10,
        method: "tools/call",
        params: {
          name: "take_screenshot",
        },
      };

      const screenshotResponse = await mcpServer.request(screenshotRequest, CallToolResultSchema);
      expect(screenshotResponse).toBeDefined();
    });
  });
});