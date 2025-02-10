import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { browserManager } from "../../src/browser.js";
import { Browser, Page, chromium } from "playwright";
import { Mock } from "vitest";

// Mock Playwright
vi.mock("playwright", () => ({
  chromium: {
    launch: vi.fn(),
  },
}));

describe("browserManager", () => {
  let mockBrowser: any;
  let mockContext: any;
  let mockPage: any;
  let launchMock: Mock;

  beforeEach(() => {
    // Reset browser state
    (browserManager as any).browser = undefined;
    (browserManager as any).page = undefined;

    // Setup mock browser hierarchy
    mockPage = {
      goto: vi.fn(),
      waitForLoadState: vi.fn(),
      evaluate: vi.fn(),
      setViewportSize: vi.fn(),
      screenshot: vi.fn(),
    };

    mockContext = {
      newPage: vi.fn().mockResolvedValue(mockPage),
      addCookies: vi.fn(),
    };

    mockBrowser = {
      newContext: vi.fn().mockResolvedValue(mockContext),
      close: vi.fn(),
    };

    launchMock = chromium.launch as Mock;
    launchMock.mockResolvedValue(mockBrowser);
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
      mockBrowser.newContext.mockClear();

      // Reset page but keep browser
      (browserManager as any).page = undefined;

      // Second call should only create new page
      await browserManager.ensureBrowser();

      expect(launchMock).not.toHaveBeenCalled();
      expect(mockBrowser.newContext).toHaveBeenCalled();
      expect(mockContext.newPage).toHaveBeenCalled();
    });
  });

  describe("safePageNavigation", () => {
    beforeEach(async () => {
      await browserManager.ensureBrowser();
    });

    it("should navigate successfully with proper response", async () => {
      const mockResponse = {
        status: vi.fn().mockReturnValue(200),
        statusText: vi.fn().mockReturnValue("OK"),
      };

      mockPage.goto.mockResolvedValue(mockResponse);
      mockPage.evaluate.mockResolvedValue({
        wordCount: 100,
        botProtection: false,
        suspiciousTitle: false,
        title: "Test Page",
      });

      await expect(
        browserManager.safePageNavigation(mockPage, "https://example.com")
      ).resolves.not.toThrow();

      expect(mockContext.addCookies).toHaveBeenCalled();
      expect(mockPage.goto).toHaveBeenCalledWith(
        "https://example.com",
        expect.any(Object)
      );
    });

    it("should throw on bot protection detection", async () => {
      mockPage.goto.mockResolvedValue({ status: () => 200 });
      mockPage.evaluate.mockResolvedValue({
        wordCount: 100,
        botProtection: true,
        suspiciousTitle: false,
        title: "Test Page",
      });

      await expect(
        browserManager.safePageNavigation(mockPage, "https://example.com")
      ).rejects.toThrow("Bot protection detected");
    });

    it("should throw on suspicious title", async () => {
      mockPage.goto.mockResolvedValue({ status: () => 200 });
      mockPage.evaluate.mockResolvedValue({
        wordCount: 100,
        botProtection: false,
        suspiciousTitle: true,
        title: "Security Check",
      });

      await expect(
        browserManager.safePageNavigation(mockPage, "https://example.com")
      ).rejects.toThrow("Suspicious page title detected");
    });

    it("should throw on insufficient content", async () => {
      mockPage.goto.mockResolvedValue({ status: () => 200 });
      mockPage.evaluate.mockResolvedValue({
        wordCount: 5,
        botProtection: false,
        suspiciousTitle: false,
        title: "Test Page",
      });

      await expect(
        browserManager.safePageNavigation(mockPage, "https://example.com")
      ).rejects.toThrow("Page contains insufficient content");
    });
  });

  describe("extractContentAsMarkdown", () => {
    beforeEach(async () => {
      await browserManager.ensureBrowser();
    });

    it("should extract content from main element", async () => {
      const mockHtml = "<main><h1>Test</h1><p>Content</p></main>";
      mockPage.evaluate.mockResolvedValue(mockHtml);

      const markdown = await browserManager.extractContentAsMarkdown(mockPage);
      expect(markdown).toContain("# Test");
      expect(markdown).toContain("Content");
    });

    it("should extract content from specific selector", async () => {
      const mockHtml = "<div><h1>Test</h1><p>Content</p></div>";
      mockPage.evaluate.mockResolvedValue(mockHtml);

      const markdown = await browserManager.extractContentAsMarkdown(
        mockPage,
        "#content"
      );
      expect(markdown).toContain("# Test");
      expect(markdown).toContain("Content");
    });

    it("should handle empty content", async () => {
      mockPage.evaluate.mockResolvedValue("");
      const markdown = await browserManager.extractContentAsMarkdown(mockPage);
      expect(markdown).toBe("");
    });
  });

  describe("takeScreenshotWithSizeLimit", () => {
    beforeEach(async () => {
      await browserManager.ensureBrowser();
    });

    it("should take screenshot with default viewport", async () => {
      const mockScreenshot = Buffer.from("test-screenshot");
      mockPage.screenshot.mockResolvedValue(mockScreenshot);

      const result = await browserManager.takeScreenshotWithSizeLimit(mockPage);
      expect(result).toBe(mockScreenshot.toString("base64"));
      expect(mockPage.setViewportSize).toHaveBeenCalledWith({
        width: 1600,
        height: 900,
      });
    });

    it("should reduce viewport size for large screenshots", async () => {
      // First screenshot is too large
      const largeScreenshot = Buffer.alloc(6 * 1024 * 1024);
      const smallScreenshot = Buffer.from("small-screenshot");
      
      mockPage.screenshot
        .mockResolvedValueOnce(largeScreenshot)
        .mockResolvedValueOnce(smallScreenshot);
      
      mockPage.viewportSize = { width: 1600, height: 900 };

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
      expect((browserManager as any).browser).toBeUndefined();
      expect((browserManager as any).page).toBeUndefined();
    });

    it("should handle cleanup when no browser exists", async () => {
      await expect(browserManager.cleanup()).resolves.not.toThrow();
    });
  });
});