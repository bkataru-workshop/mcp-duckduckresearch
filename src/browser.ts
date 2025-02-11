import { type Browser, type Page, chromium } from "playwright";
import TurndownService from "turndown";
import type { Node } from "turndown";
import { withRetry } from "./utils.js";

/**
 * Initialize Turndown service for converting HTML to Markdown with custom settings
 */
const turndownService = new TurndownService({
  headingStyle: "atx",
  hr: "---",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  emDelimiter: "_",
  strongDelimiter: "**",
  linkStyle: "inlined",
});

// Custom Turndown rules for content processing
turndownService.addRule("removeScripts", {
  filter: ["script", "style", "noscript"],
  replacement: () => "",
});

turndownService.addRule("preserveLinks", {
  filter: "a",
  replacement: (content: string, node: Node) => {
    const element = node as HTMLAnchorElement;
    const href = element.getAttribute("href");
    return href ? `[${content}](${href})` : content;
  },
});

turndownService.addRule("preserveImages", {
  filter: "img",
  replacement: (_content: string, node: Node) => {
    const element = node as HTMLImageElement;
    const alt = element.getAttribute("alt") || "";
    const src = element.getAttribute("src");
    return src ? `![${alt}](${src})` : "";
  },
});

/**
 * Manages browser instances and provides high-level browser operations
 * for web page interaction, content extraction, and screenshot capture.
 */
export class BrowserManager {
  private browser?: Browser;
  private page?: Page;

  /**
   * Resets the browser and page instances for testing purposes.
   *
   * @example
   * ```typescript
   * browserManager.resetBrowser();
   * ```
   */
  resetBrowser(): void {
    this.browser = undefined;
    this.page = undefined;
  }

  /**
   * Ensures a browser instance and page are available.
   * Creates new ones if they don't exist.
   *
   * @returns Promise resolving to a Page instance
   *
   * @example
   * ```typescript
   * const page = await browserManager.ensureBrowser();
   * ```
   */
  async ensureBrowser(): Promise<Page> {
    console.log("ensureBrowser: started");
    if (!this.browser) {
      console.log("ensureBrowser: launching browser");
      try {
        this.browser = await chromium.launch({
          headless: true,
        });
        console.log("ensureBrowser: browser launched");
      } catch (e) {
        const error = new Error(`Browser launch failed: ${(e as Error).message}`);
        console.error("ensureBrowser: Browser launch failed", error);
        throw error;
      }

      const context = await this.browser.newContext();
      this.page = await context.newPage();
    }

    if (!this.page) {
      const context = await this.browser.newContext();
      this.page = await context.newPage();
    }
    console.log("ensureBrowser: finished");
    return this.page;
  }

  /**
   * Cleans up browser resources by closing the browser instance.
   *
   * @returns Promise that resolves when cleanup is complete
   */
  async cleanup(): Promise<void> {
    console.log("cleanup: started");
    if (this.browser) {
      try {
        console.log("cleanup: closing browser");
        await this.browser.close();
        console.log("cleanup: browser closed");
      } catch (e) {
        console.error("cleanup: Error closing browser", e);
      } finally {
        this.browser = undefined;
        this.page = undefined;
      }
    }
    console.log("cleanup: finished");
  }

  /**
   * Safely navigates to a URL with comprehensive validation and security checks.
   * Handles common anti-bot measures and validates page content.
   *
   * @param page - Playwright Page instance
   * @param url - URL to navigate to
   * @throws {Error} If navigation fails, bot protection is detected, or content is invalid
   *
   * @example
   * ```typescript
   * const page = await browserManager.ensureBrowser();
   * await browserManager.safePageNavigation(page, "https://example.com");
   * ```
   */
  async safePageNavigation(page: Page, url: string): Promise<void> {
    console.log("safePageNavigation: started", url);
    try {
      const context = await page.context();
      await context.addCookies([
        { name: "CONSENT", value: "YES+", domain: ".google.com", path: "/" },
      ]);
      console.log("safePageNavigation: cookies added");

      // Initial navigation
      console.log("safePageNavigation: navigating to url", url);
      const response = await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 15000,
      });
      console.log("safePageNavigation: navigation response received", response?.status());

      if (!response) {
        const error = new Error("Navigation failed: no response received");
        console.error("safePageNavigation: Navigation failed", error);
        throw error;
      }

      const status = response.status();
      if (status >= 400) {
        const error = new Error(`HTTP ${status}: ${response.statusText()}`);
        console.error("safePageNavigation: HTTP error", error);
        throw error;
      }

      // Wait for network to become idle or timeout
      console.log("safePageNavigation: waiting for network idle");
      await Promise.race([
        page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {
          /* ignore timeout */
        }),
        new Promise((resolve) => setTimeout(resolve, 5000)),
      ]);
      console.log("safePageNavigation: network idle wait finished");

      // Security and content validation
      console.log("safePageNavigation: running page evaluate");
      const validation = await page.evaluate(() => {
        const botProtectionExists = [
          "#challenge-running",
          "#cf-challenge-running",
          "#px-captcha",
          "#ddos-protection",
          "#waf-challenge-html",
        ].some((selector) => document.querySelector(selector));

        const suspiciousTitle = [
          "security check",
          "ddos protection",
          "please wait",
          "just a moment",
          "attention required",
        ].some((phrase) => document.title.toLowerCase().includes(phrase));

        const bodyText = document.body.innerText || "";
        const words = bodyText.trim().split(/\s+/).length;

        return {
          wordCount: words,
          botProtection: botProtectionExists,
          suspiciousTitle,
          title: document.title,
        };
      });
      console.log("safePageNavigation: page evaluate finished", validation);

      if (validation.botProtection) {
        const error = new Error("Bot protection detected");
        console.error("safePageNavigation: Bot protection detected", error);
        throw error;
      }

      if (validation.suspiciousTitle) {
        const error = new Error("Suspicious page title detected");
        console.error("safePageNavigation: Suspicious page title detected", error);
        throw error;
      }

      if (validation.wordCount < 10) {
        const error = new Error("Page contains insufficient content");
        console.error("safePageNavigation: Page contains insufficient content", error);
        throw error;
      }
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes("Bot protection") ||
          error.message.includes("Suspicious page title") ||
          error.message.includes("insufficient content"))
      ) {
        throw error;
      }
      const navigationError = new Error(`Navigation to ${url} failed: ${(error as Error).message}`);
      console.error("safePageNavigation: Navigation failed", navigationError);
      throw navigationError;
    }
    console.log("safePageNavigation: finished");
  }

  /**
   * Extracts content from a webpage and converts it to Markdown format.
   * Attempts to find main content area using common selectors.
   *
   * @param page - Playwright Page instance
   * @param selector - Optional CSS selector to target specific content
   * @returns Promise resolving to Markdown content
   *
   * @example
   * ```typescript
   * const content = await browserManager.extractContentAsMarkdown(
   *   page,
   *   "article.main-content"
   * );
   * ```
   */
  async extractContentAsMarkdown(page: Page, selector?: string): Promise<string> {
    console.log("extractContentAsMarkdown: started", selector);
    try {
      const html = await page.evaluate((sel) => {
        if (sel) {
          const element = document.querySelector(sel);
          return element ? element.outerHTML : "";
        }

        const contentSelectors = [
          "main",
          "article",
          '[role="main"]',
          "#content",
          ".content",
          ".main",
          ".post",
          ".article",
        ];

        for (const contentSelector of contentSelectors) {
          const element = document.querySelector(contentSelector);
          if (element) {
            return element.outerHTML;
          }
        }

        const body = document.body;
        const elementsToRemove = [
          "header",
          "footer",
          "nav",
          '[role="navigation"]',
          "aside",
          ".sidebar",
          '[role="complementary"]',
          ".nav",
          ".menu",
          ".header",
          ".footer",
          ".advertisement",
          ".ads",
          ".cookie-notice",
        ];

        for (const sel of elementsToRemove) {
          for (const el of body.querySelectorAll(sel)) {
            el.remove();
          }
        }

        return body.outerHTML;
      }, selector);

      if (!html) {
        console.log("extractContentAsMarkdown: html is empty");
        return "";
      }

      try {
        console.log("extractContentAsMarkdown: converting HTML to markdown");
        const markdown = turndownService.turndown(html);
        const processedMarkdown = markdown
          .replace(/\n{3,}/g, "\n\n")
          .replace(/^- $/gm, "")
          .replace(/^\s+$/gm, "")
          .trim();
        console.log("extractContentAsMarkdown: finished", processedMarkdown);
        return processedMarkdown;
      } catch (error) {
        console.error("extractContentAsMarkdown: Error converting HTML to Markdown:", error);
        return html;
      }
    } catch (e) {
      const error = new Error(`Content extraction failed: ${(e as Error).message}`);
      console.error("extractContentAsMarkdown: Content extraction failed", error);
      throw error;
    }
  }

  /**
   * Takes a screenshot of the current page with automatic size optimization.
   * Reduces viewport size if screenshot exceeds size limit.
   *
   * @param page - Playwright Page instance
   * @returns Promise resolving to base64 encoded screenshot
   * @throws {Error} If screenshot can't be reduced to under size limit
   *
   * @example
   * ```typescript
   * const screenshot = await browserManager.takeScreenshotWithSizeLimit(page);
   * ```
   */
  async takeScreenshotWithSizeLimit(page: Page): Promise<string> {
    console.log("takeScreenshotWithSizeLimit: started");
    const MAX_DIMENSION = 1920;
    const MIN_DIMENSION = 800;

    console.log("takeScreenshotWithSizeLimit: setting viewport size 1600x900");
    await page.setViewportSize({
      width: 1600,
      height: 900,
    });

    console.log("takeScreenshotWithSizeLimit: taking screenshot attempt 1");
    let screenshot = await page.screenshot({
      type: "png",
      fullPage: false,
    });

    let attempts = 0;
    const MAX_ATTEMPTS = 3;

    while (screenshot.length > 5 * 1024 * 1024 && attempts < MAX_ATTEMPTS) {
      attempts++;
      const scaleFactor = 0.75 ** attempts;
      const newWidth = Math.round(1600 * scaleFactor);
      let newHeight = Math.round(900 * scaleFactor);

      // Ensure dimensions stay within bounds  newWidth = Math.max(MIN_DIMENSION, Math.min(MAX_DIMENSION, newWidth));
      newHeight = Math.max(MIN_DIMENSION, Math.min(MAX_DIMENSION, newHeight));

      console.log(`takeScreenshotWithSizeLimit: reducing viewport size to ${newWidth}x${newHeight}, attempt ${attempts}`);
      await page.setViewportSize({
        width: newWidth,
        height: newHeight,
      });

      console.log(`takeScreenshotWithSizeLimit: taking screenshot attempt ${attempts + 1}`);
      screenshot = await page.screenshot({
        type: "png",
        fullPage: false,
      });
    }

    if (screenshot.length > 5 * 1024 * 1024) {
      console.log("takeScreenshotWithSizeLimit: screenshot still too large, reducing to minimum dimensions");
      await page.setViewportSize({
        width: MIN_DIMENSION,
        height: MIN_DIMENSION,
      });

      screenshot = await page.screenshot({
        type: "png",
        fullPage: false,
      });

      if (screenshot.length > 5 * 1024 * 1024) {
        const error = new Error("Failed to reduce screenshot to under 5MB even with minimum settings");
        console.error("takeScreenshotWithSizeLimit: Failed to reduce screenshot size", error);
        throw error;
      }
    }
    console.log("takeScreenshotWithSizeLimit: finished");
    return screenshot.toString("base64");
  }
}

// Export singleton instance
export const browserManager = new BrowserManager();
