import { McpError } from "@modelcontextprotocol/sdk/types.js";
import { SafeSearchType, search } from "duck-duck-scrape";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { performSearch } from "../../src/search.js";
import type { SearchArgs } from "../../src/types.js";

// Create a typed mock for search
const mockSearch = search as unknown as Mock<typeof search>;

// Mock duck-duck-scrape
vi.mock("duck-duck-scrape", () => ({
  search: vi.fn(),
  SafeSearchType: {
    OFF: "OFF",
    MODERATE: "MODERATE",
    STRICT: "STRICT",
  },
}));

describe("search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockSearchResult = {
    results: [
      {
        title: "Test Result 1",
        url: "https://docs.example.com/guide",
        description: "A test result description",
        hostname: "docs.example.com",
        rawDescription: "A test result description",
        icon: "",
      },
      {
        title: "GitHub - Example/Project",
        url: "https://github.com/example/project",
        description: "A GitHub repository",
        hostname: "github.com",
        rawDescription: "A GitHub repository",
        icon: "",
      },
      {
        title: "Social Media Post",
        url: "https://twitter.com/user/status/123",
        description: "A social media post",
        hostname: "twitter.com",
        rawDescription: "A social media post",
        icon: "",
      },
    ],
    noResults: false,
    vqd: "3-0",
  };

  it("should perform search with default options", async () => {
    mockSearch.mockResolvedValue(mockSearchResult);

    const result = await performSearch({
      query: "test query",
    });

    expect(search).toHaveBeenCalledWith("test query", {
      region: "zh-cn",
      safeSearch: SafeSearchType.MODERATE,
      numResults: 50,
    });

    expect(result.type).toBe("search_results");
    expect(result.data).toHaveLength(3);
    expect(result.metadata.query).toBe("test query");
    expect(result.metadata.searchContext).toEqual({
      region: "zh-cn",
      safeSearch: SafeSearchType.MODERATE,
      numResults: 50,
    });
  });

  it("should perform search with custom options", async () => {
    mockSearch.mockResolvedValue(mockSearchResult);

    const result = await performSearch({
      query: "test query",
      options: {
        region: "us-en",
        safeSearch: SafeSearchType.STRICT,
        numResults: 25,
      },
    });

    expect(search).toHaveBeenCalledWith("test query", {
      region: "us-en",
      safeSearch: SafeSearchType.STRICT,
      numResults: 25,
    });

    expect(result.metadata.searchContext).toEqual({
      region: "us-en",
      safeSearch: SafeSearchType.STRICT,
      numResults: 25,
    });
  });

  it("should detect content types correctly", async () => {
    mockSearch.mockResolvedValue(mockSearchResult);

    const result = await performSearch({ query: "test query" });

    expect(result.data[0].metadata.type).toBe("documentation"); // docs.example.com
    expect(result.data[1].metadata.type).toBe("documentation"); // github.com
    expect(result.data[2].metadata.type).toBe("social"); // twitter.com
  });

  it("should handle search errors", async () => {
    mockSearch.mockRejectedValue(new Error("Search failed"));

    await expect(performSearch({ query: "test query" })).rejects.toThrow();
  });

  it("should validate input arguments", async () => {
    await expect(
      performSearch({
        query: "",
        options: {
          numResults: -1,
        },
      } as unknown as SearchArgs)
    ).rejects.toThrow();
  });

  it("should detect language based on query", async () => {
    mockSearch.mockResolvedValue(mockSearchResult);

    // English query
    let result = await performSearch({ query: "test query" });
    expect(result.metadata.queryAnalysis.language).toBe("en");

    // Chinese query (contains hyphen)
    result = await performSearch({ query: "测试-查询" });
    expect(result.metadata.queryAnalysis.language).toBe("zh-cn");
  });

  it("should detect topics from results", async () => {
    mockSearch.mockResolvedValue({
      results: [
        {
          title: "GitHub - Project",
          url: "https://github.com/example",
          description: "A project",
          hostname: "github.com",
          rawDescription: "A project",
          icon: "",
        },
        {
          title: "Documentation",
          url: "https://docs.example.com",
          description: "Some docs",
          hostname: "docs.example.com",
          rawDescription: "Some docs",
          icon: "",
        },
      ],
      noResults: false,
      vqd: "3-0",
    });

    const result = await performSearch({ query: "test query" });
    expect(result.metadata.queryAnalysis.topics).toContain("technology");
    expect(result.metadata.queryAnalysis.topics).toContain("documentation");
  });
});
