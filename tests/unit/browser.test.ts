import { type Browser, type BrowserContext, type Page, chromium } from "playwright";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { browserManager } from "../../src/browser.js";

vi.mock("playwright", () => ({
  chromium: {
    launch: vi.fn(),
  },
}));

describe("browserManager", () => {
  let mockBrowser: Browser;
  let mockContext: BrowserContext;
  let mockPage: Page;
  let launchMock: Mock;

  beforeEach(() => {
    // Reset browser state
    browserManager.resetBrowser();

    // Setup mock browser hierarchy
    mockPage = {
      goto: vi.fn(),
      waitForLoadState: vi.fn(),
      evaluate: vi.fn(),
      setViewportSize: vi.fn(),
      screenshot: vi.fn(),
      context: vi.fn(),
    } as unknown as Page;

    mockContext = {
      newPage: vi.fn().mockResolvedValue(mockPage),
      addCookies: vi.fn(),
    } as unknown as BrowserContext;

    mockBrowser = {
      newContext: vi.fn().mockResolvedValue(mockContext),
      close: vi.fn(),
    } as unknown as Browser;

    launchMock = chromium.launch as Mock;
    launchMock.mockResolvedValue(mockBrowser);

    // Ensure the mock of page.context returns the mocked context
    (mockPage.context as Mock).mockReturnValue(mockContext);
    (mockPage.waitForLoadState as Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("ensureBrowser", () => {
    it("should create new browser and page when none exist", async () => {
      const page = await browserManager.ensureBrowser();

      expect(launchMock).toHaveBeenCalledWith({ headless: true });
      expect(mockBrowser.newContext).toHaveBeenCalled();
      expect(mockContext.newPage).toHaveBeenCalled();
      expect(page).toBe(mockPage);
    });

    it("should reuse existing browser but create new page if needed", async () => {
      // First call creates everything
      await browserManager.ensureBrowser();
      launchMock.mockClear();
      (mockBrowser.newContext as Mock).mockClear();

      // Reset just the page but keep browser
      (browserManager as any).page = undefined;

      // Second call should only create new page
      const page = await browserManager.ensureBrowser();

      expect(launchMock).not.toHaveBeenCalled();
      expect(mockBrowser.newContext).toHaveBeenCalled();
      expect(mockContext.newPage).toHaveBeenCalled();
    });
  });

  describe("safePageNavigation", () => {
    it("should navigate successfully with proper response", async () => {
      (mockPage.goto as Mock).mockResolvedValue({
        status: () => 200,
        statusText: () => "OK",
      });

      (mockPage.evaluate as Mock).mockResolvedValue({
        wordCount: 100,
        botProtection: false,
        suspiciousTitle: false,
        title: "Test Page",
      });

      await browserManager.safePageNavigation(mockPage, "https://example.com");

      expect(mockContext.addCookies).toHaveBeenCalled();
      expect(mockPage.goto).toHaveBeenCalledWith(
        "https://example.com",
        expect.objectContaining({
          waitUntil: "domcontentloaded",
          timeout: 15000,
        })
      );
      expect(mockPage.waitForLoadState).toHaveBeenCalledWith("networkidle", expect.any(Object));
    });

    it("should throw on bot protection detection", async () => {
      (mockPage.goto as Mock).mockResolvedValue({
        status: () => 200,
        statusText: () => "OK",
      });

      (mockPage.evaluate as Mock).mockResolvedValue({
        wordCount: 100,
        botProtection: true,
        suspiciousTitle: false,
        title: "Test Page",
      });

      await expect(() =>
        browserManager.safePageNavigation(mockPage, "https://example.com")
      ).rejects.toThrow("Bot protection detected");
    });

    it("should throw on suspicious title", async () => {
      (mockPage.goto as Mock).mockResolvedValue({
        status: () => 200,
        statusText: () => "OK",
      });

      (mockPage.evaluate as Mock).mockResolvedValue({
        wordCount: 100,
        botProtection: false,
        suspiciousTitle: true,
        title: "Test Page",
      });

      await expect(() =>
        browserManager.safePageNavigation(mockPage, "https://example.com")
      ).rejects.toThrow("Suspicious page title detected");
    });

    it("should throw on insufficient content", async () => {
      (mockPage.goto as Mock).mockResolvedValue({
        status: () => 200,
        statusText: () => "OK",
      });

      (mockPage.evaluate as Mock).mockResolvedValue({
        wordCount: 5,
        botProtection: false,
        suspiciousTitle: false,
        title: "Test Page",
      });

      await expect(() =>
        browserManager.safePageNavigation(mockPage, "https://example.com")
      ).rejects.toThrow("Page contains insufficient content");
    });
  });

  describe("extractContentAsMarkdown", () => {
    it("should extract content from main element", async () => {
      (mockPage.evaluate as Mock).mockResolvedValue("<main><h1>Test</h1><p>Content</p></main>");
      const markdown = await browserManager.extractContentAsMarkdown(mockPage);
      expect(markdown).toContain("# Test");
      expect(markdown).toContain("Content");
    });

    it("should extract content from specific selector", async () => {
      (mockPage.evaluate as Mock).mockResolvedValue("<div><h1>Test</h1><p>Content</p></div>");
      const markdown = await browserManager.extractContentAsMarkdown(mockPage, "#content");
      expect(markdown).toContain("# Test");
      expect(markdown).toContain("Content");
    });

    it("should handle empty content", async () => {
      (mockPage.evaluate as Mock).mockResolvedValue("");
      const markdown = await browserManager.extractContentAsMarkdown(mockPage);
      expect(markdown).toBe("");
    });
  });

  describe("takeScreenshotWithSizeLimit", () => {
    it("should take screenshot with default viewport", async () => {
      const mockScreenshot = Buffer.from("test-screenshot");
      (mockPage.screenshot as Mock).mockResolvedValue(mockScreenshot);
      (mockPage.setViewportSize as Mock).mockImplementation(() => {});

      const result = await browserManager.takeScreenshotWithSizeLimit(mockPage);

      expect(mockPage.setViewportSize).toHaveBeenCalledWith({ width: 1600, height: 900 });
      expect(result).toBe(mockScreenshot.toString("base64"));
    });

    it("should reduce viewport size for large screenshots", async () => {
      const largeScreenshot = Buffer.alloc(6 * 1024 * 1024);
      const smallScreenshot = Buffer.from("small-screenshot");

      (mockPage.screenshot as Mock)
        .mockResolvedValueOnce(largeScreenshot)
        .mockResolvedValueOnce(smallScreenshot);
      (mockPage.setViewportSize as Mock).mockImplementation(() => {});

      const result = await browserManager.takeScreenshotWithSizeLimit(mockPage);

      expect(mockPage.setViewportSize).toHaveBeenCalledTimes(2);
      expect(result).toBe(smallScreenshot.toString("base64"));
    });
  });

  describe("cleanup", () => {
    it("should close browser and reset state", async () => {
      await browserManager.ensureBrowser();
      await browserManager.cleanup();

      expect(mockBrowser.close).toHaveBeenCalled();
      const internalState = browserManager as unknown as { browser?: Browser; page?: Page };
      expect(internalState.browser).toBeUndefined();
      expect(internalState.page).toBeUndefined();
    });

    it("should handle cleanup when no browser exists", async () => {
      await expect(browserManager.cleanup()).resolves.not.toThrow();
    });
  });
});
