import { chromium, Browser, Page } from "playwright";
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
  replacement: (content: string, node: Node) => {
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
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
      });
      const context = await this.browser.newContext();
      this.page = await context.newPage();
    }

    if (!this.page) {
      const context = await this.browser.newContext();
      this.page = await context.newPage();
    }

    return this.page;
  }

  /**
   * Cleans up browser resources by closing the browser instance.
   * 
   * @returns Promise that resolves when cleanup is complete
   */
  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = undefined;
      this.page = undefined;
    }
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
    try {
      // Set cookies to bypass consent banner
      await page.context().addCookies([
        {
          name: "CONSENT",
          value: "YES+",
          domain: ".google.com",
          path: "/",
        },
      ]);

      // Initial navigation
      const response = await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 15000,
      });

      if (!response) {
        throw new Error("Navigation failed: no response received");
      }

      const status = response.status();
      if (status >= 400) {
        throw new Error(`HTTP ${status}: ${response.statusText()}`);
      }

      // Wait for network to become idle or timeout
      await Promise.race([
        page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {
          /* ignore timeout */
        }),
        new Promise((resolve) => setTimeout(resolve, 5000)),
      ]);

      // Security and content validation
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

      if (validation.botProtection) {
        throw new Error("Bot protection detected");
      }

      if (validation.suspiciousTitle) {
        throw new Error(`Suspicious page title detected: "${validation.title}"`);
      }

      if (validation.wordCount < 10) {
        throw new Error("Page contains insufficient content");
      }
    } catch (error) {
      throw new Error(`Navigation to ${url} failed: ${(error as Error).message}`);
    }
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

      elementsToRemove.forEach((sel) => {
        body.querySelectorAll(sel).forEach((el) => el.remove());
      });

      return body.outerHTML;
    }, selector);

    if (!html) {
      return "";
    }

    try {
      const markdown = turndownService.turndown(html);
      return markdown
        .replace(/\n{3,}/g, "\n\n")
        .replace(/^- $/gm, "")
        .replace(/^\s+$/gm, "")
        .trim();
    } catch (error) {
      console.error("Error converting HTML to Markdown:", error);
      return html;
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
    const MAX_DIMENSION = 1920;
    const MIN_DIMENSION = 800;

    await page.setViewportSize({
      width: 1600,
      height: 900,
    });

    let screenshot = await page.screenshot({
      type: "png",
      fullPage: false,
    });

    let attempts = 0;
    const MAX_ATTEMPTS = 3;

    while (screenshot.length > 5 * 1024 * 1024 && attempts < MAX_ATTEMPTS) {
      const viewport = page.viewportSize();
      if (!viewport) continue;

      const scaleFactor = Math.pow(0.75, attempts + 1);
      let newWidth = Math.round(viewport.width * scaleFactor);
      let newHeight = Math.round(viewport.height * scaleFactor);

      newWidth = Math.max(MIN_DIMENSION, Math.min(MAX_DIMENSION, newWidth));
      newHeight = Math.max(MIN_DIMENSION, Math.min(MAX_DIMENSION, newHeight));

      await page.setViewportSize({
        width: newWidth,
        height: newHeight,
      });

      screenshot = await page.screenshot({
        type: "png",
        fullPage: false,
      });

      attempts++;
    }

    if (screenshot.length > 5 * 1024 * 1024) {
      await page.setViewportSize({
        width: MIN_DIMENSION,
        height: MIN_DIMENSION,
      });

      screenshot = await page.screenshot({
        type: "png",
        fullPage: false,
      });

      if (screenshot.length > 5 * 1024 * 1024) {
        throw new Error("Failed to reduce screenshot to under 5MB even with minimum settings");
      }
    }

    return screenshot.toString("base64");
  }
}

// Export singleton instance
export const browserManager = new BrowserManager();