import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

/**
 * Maximum number of retry attempts for operations
 * @constant {number}
 */
export const MAX_RETRIES = 3;

/**
 * Delay between retry attempts in milliseconds
 * @constant {number}
 */
export const RETRY_DELAY = 1000;

/**
 * Maximum allowed size for screenshots in bytes (5MB)
 * @constant {number}
 */
export const MAX_SCREENSHOT_SIZE = 5 * 1024 * 1024;

/**
 * Temporary directory for storing screenshots
 * @constant {string}
 */
export const SCREENSHOTS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-screenshots-"));

/**
 * Validates a URL string for security and format.
 * Ensures the URL uses either http or https protocol.
 * 
 * @param urlString - The URL string to validate
 * @returns boolean indicating if the URL is valid and safe
 * 
 * @example
 * ```typescript
 * if (isValidUrl("https://example.com")) {
 *   // URL is valid and safe
 * }
 * ```
 */
export function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Generic retry mechanism for handling transient failures.
 * Attempts an operation multiple times with a delay between attempts.
 * 
 * @param operation - Async operation to retry
 * @param retries - Maximum number of retry attempts (default: MAX_RETRIES)
 * @param delay - Delay between retries in milliseconds (default: RETRY_DELAY)
 * @returns Promise resolving to the operation result
 * @throws Last error encountered if all retries fail
 * 
 * @example
 * ```typescript
 * const result = await withRetry(
 *   async () => await someFlakeOperation(),
 *   3,  // retries
 *   1000 // delay in ms
 * );
 * ```
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  retries = MAX_RETRIES,
  delay = RETRY_DELAY
): Promise<T> {
  let lastError: Error;

  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      if (i < retries - 1) {
        console.error(`Attempt ${i + 1} failed, retrying in ${delay}ms:`, error);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
}

/**
 * Saves a base64 encoded screenshot to disk with size validation.
 * Creates a unique filename using the provided title and timestamp.
 * 
 * @param screenshot - Base64 encoded screenshot data
 * @param title - Title to use in filename (will be sanitized)
 * @returns Promise resolving to the saved file path
 * @throws {McpError} If screenshot exceeds size limit
 * 
 * @example
 * ```typescript
 * const filepath = await saveScreenshot(
 *   base64Data,
 *   "homepage-screenshot"
 * );
 * ```
 */
export async function saveScreenshot(screenshot: string, title: string): Promise<string> {
  const buffer = Buffer.from(screenshot, "base64");

  if (buffer.length > MAX_SCREENSHOT_SIZE) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      `Screenshot too large: ${Math.round(buffer.length / (1024 * 1024))}MB exceeds ${
        MAX_SCREENSHOT_SIZE / (1024 * 1024)
      }MB limit`
    );
  }

  const timestamp = new Date().getTime();
  const safeTitle = title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  const filename = `${safeTitle}-${timestamp}.png`;
  const filepath = path.join(SCREENSHOTS_DIR, filename);

  await fs.promises.writeFile(filepath, buffer);
  return filepath;
}

/**
 * Cleans up all screenshots from the temporary directory.
 * Should be called during server shutdown or cleanup.
 * 
 * @returns Promise that resolves when cleanup is complete
 * 
 * @example
 * ```typescript
 * // During server shutdown
 * await cleanupScreenshots();
 * ```
 */
export async function cleanupScreenshots(): Promise<void> {
  try {
    const files = await fs.promises.readdir(SCREENSHOTS_DIR, { withFileTypes: false });
    await Promise.all(
      files.map((file) => fs.promises.unlink(path.join(SCREENSHOTS_DIR, file)))
    );
    await fs.promises.rmdir(SCREENSHOTS_DIR);
  } catch (error) {
    console.error("Error cleaning up screenshots:", error);
  }
}