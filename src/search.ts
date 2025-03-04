import { SafeSearchType, search } from "duck-duck-scrape";
import { z } from "zod";
import {
  type SearchArgs,
  SearchArgsSchema,
  type SearchOptions,
  type SearchResponse,
  type SearchResult,
} from "./types.js";

/**
 * Detects the content type of a search result based on its URL.
 *
 * @param result - The search result to analyze
 * @returns The detected content type ("documentation", "social", or "article")
 *
 * @internal
 */
function detectContentType(result: DuckDuckGoResult): SearchResult["metadata"]["type"] {
  const url = result.url.toLowerCase();
  if (url.includes("docs.") || url.includes("/docs/") || url.includes("/documentation/")) {
    return "documentation";
  }
  if (url.includes("github.com") || url.includes("stackoverflow.com")) {
    return "documentation";
  }
  if (url.includes("twitter.com") || url.includes("facebook.com") || url.includes("linkedin.com")) {
    return "social";
  }
  return "article";
}

/**
 * Detects the language of a search query using basic heuristics.
 * Currently detects Chinese queries based on hyphen presence.
 *
 * @param query - The search query to analyze
 * @returns The detected language code ("zh-cn" or "en")
 *
 * @internal
 */
function detectLanguage(query: string): string {
  return /[-]/.test(query) ? "zh-cn" : "en";
}

/**
 * Analyzes search results to detect common topics.
 * Currently detects technology and documentation related topics.
 *
 * @param results - Array of search results to analyze
 * @returns Array of detected topics
 *
 * @internal
 */
interface DuckDuckGoResult {
  title: string;
  url: string;
  description: string;
}

function detectTopics(results: DuckDuckGoResult[]): string[] {
  const topics = new Set<string>();
  for (const result of results) {
    if (result.title.toLowerCase().includes("github")) topics.add("technology");
    if (
      result.title.toLowerCase().includes("docs") ||
      result.title.toLowerCase().includes("documentation")
    ) {
      topics.add("documentation");
    }
  }
  return Array.from(topics);
}

/**
 * Processes raw search results into a structured SearchResponse format.
 * Adds metadata, content type detection, and query analysis.
 *
 * @param results - Raw search results from duck-duck-scrape
 * @param query - Original search query
 * @param options - Search options used
 * @returns Structured search response with metadata
 *
 * @internal
 */
function processSearchResults(
  results: DuckDuckGoResult[],
  query: string,
  options: SearchArgs["options"]
): SearchResponse {
  return {
    type: "search_results",
    data: results.map(
      (result: DuckDuckGoResult) =>
        ({
          title: result.title.replace(/&#x27;/g, "'").replace(/"/g, '"'),
          url: result.url,
          description: result.description.trim(),
          metadata: {
            type: detectContentType(result as SearchResult),
            source: new URL(result.url).hostname,
          },
        }) as SearchResult
    ),
    metadata: {
      query,
      timestamp: new Date().toISOString(),
      resultCount: results.length,
      searchContext: {
        region: options?.region || "zh-cn",
        safeSearch: options?.safeSearch || SafeSearchType.MODERATE,
        numResults: options?.numResults || 50,
      },
      queryAnalysis: {
        language: detectLanguage(query),
        topics: detectTopics(results),
      },
    },
  };
}

/**
 * Performs a search using DuckDuckGo with enhanced processing and metadata.
 * Validates arguments, executes the search, and processes results into a structured format.
 *
 * @param args - Search arguments including query and optional parameters
 * @returns Promise resolving to processed search results with metadata
 * @throws {Error} If arguments are invalid or search fails
 *
 * @example
 * ```typescript
 * const results = await performSearch({
 *   query: "typescript best practices",
 *   options: {
 *     region: "us-en",
 *     safeSearch: SafeSearchType.MODERATE,
 *     numResults: 10
 *   }
 * });
 * ```
 */
export async function performSearch(args: SearchArgs): Promise<SearchResponse> {
  console.log("performSearch: started", args);
  const parsedArgs = SearchArgsSchema.safeParse(args);
  if (!parsedArgs.success) {
    const error = new Error(`Invalid arguments: ${parsedArgs.error}`);
    console.error("performSearch: Invalid arguments", error);
    throw error;
  }

  const safeSearch = parsedArgs.data.options?.safeSearch || SafeSearchType.MODERATE;

  const searchOptions: SearchOptions = {
    region: parsedArgs.data.options?.region || "zh-cn",
    safeSearch,
    numResults:
      parsedArgs.data.options?.numResults !== undefined ? parsedArgs.data.options.numResults : 50,
  };

  try {
    console.log("performSearch: calling search", parsedArgs.data.query, searchOptions);
    const searchResults = await search(parsedArgs.data.query, searchOptions);
    console.log("performSearch: search returned", searchResults);
    const processedResults = processSearchResults(searchResults.results, parsedArgs.data.query, {
      region: parsedArgs.data.options?.region || "zh-cn",
      safeSearch,
      numResults: parsedArgs.data.options?.numResults || 50,
    });
    console.log("performSearch: finished", processedResults);
    return processedResults;
  } catch (e) {
    const error = new Error(`Search failed: ${(e as Error).message}`);
    console.error("performSearch: Search failed", error);
    throw error;
  }
}
