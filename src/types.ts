import { SafeSearchType } from "duck-duck-scrape";
import { z } from "zod";

/**
 * Schema for search tool arguments
 * @example
 * ```typescript
 * const searchArgs = {
 *   query: "typescript best practices",
 *   options: {
 *     region: "us-en",
 *     safeSearch: "MODERATE",
 *     numResults: 10
 *   }
 * };
 * ```
 */
export const SearchArgsSchema = z.object({
  query: z.string().describe("Search query"),
  options: z
    .object({
      region: z.string().default("zh-cn").describe("Search region"),
      safeSearch: z
        .nativeEnum(SafeSearchType)
        .default(SafeSearchType.MODERATE)
        .describe("Safe search level"),
      numResults: z.number().default(50).describe("Number of results to return"),
    })
    .optional(),
});

/**
 * Type definition for search tool arguments derived from schema
 */
export type SearchArgs = z.infer<typeof SearchArgsSchema>;

/**
 * Schema for visit page tool arguments
 * @example
 * ```typescript
 * const visitArgs = {
 *   url: "https://example.com",
 *   takeScreenshot: true
 * };
 * ```
 */
export const VisitPageArgsSchema = z.object({
  url: z.string().url().describe("URL to visit"),
  takeScreenshot: z.boolean().optional().describe("Whether to take a screenshot"),
});

/**
 * Type definition for visit page tool arguments derived from schema
 */
export type VisitPageArgs = z.infer<typeof VisitPageArgsSchema>;

/**
 * Represents the result of researching a web page, including its content and optional screenshot
 */
export interface ResearchResult {
  /** URL of the researched page */
  url: string;
  /** Page title */
  title: string;
  /** Extracted content in Markdown format */
  content: string;
  /** ISO timestamp of when the research was conducted */
  timestamp: string;
  /** Path to saved screenshot if one was taken */
  screenshotPath?: string;
}

/**
 * Represents a single search result with metadata
 */
export interface SearchResult {
  /** Title of the search result */
  title: string;
  /** URL of the result */
  url: string;
  /** Description or snippet from the result */
  description: string;
  /** Additional metadata about the result */
  metadata: {
    /** Type of content (documentation, social media, article) */
    type: "documentation" | "social" | "article";
    /** Source domain of the result */
    source: string;
  };
}

/**
 * Complete response from a search operation including results and metadata
 */
export interface SearchResponse {
  /** Discriminator for response type */
  type: "search_results";
  /** Array of search results */
  data: SearchResult[];
  /** Metadata about the search operation */
  metadata: {
    /** Original search query */
    query: string;
    /** ISO timestamp of when the search was conducted */
    timestamp: string;
    /** Number of results found */
    resultCount: number;
    /** Context in which the search was performed */
    searchContext: {
      /** Region setting used for search */
      region: string;
      /** Safe search level applied */
      safeSearch: SafeSearchType;
      /** Number of results requested */
      numResults?: number;
    };
    /** Analysis of the query and results */
    queryAnalysis: {
      /** Detected language of the query */
      language: string;
      /** Topics detected in the results */
      topics: string[];
    };
  };
}

/**
 * Standard error response format
 */
export interface ErrorResponse {
  /** Discriminator for error responses */
  type: "error";
  /** Error message */
  message: string;
  /** Optional suggestion for resolving the error */
  suggestion?: string;
  /** Optional context information about the error */
  context?: unknown;
}

/**
 * Search options matching the duck-duck-scrape API
 */
export interface SearchOptions {
  /** Region for search results */
  region?: string;
  /** Safe search filtering level */
  safeSearch?: SafeSearchType;
  /** Number of results to return */
  numResults?: number;
}
