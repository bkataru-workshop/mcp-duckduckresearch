import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  isValidUrl,
  withRetry,
  saveScreenshot,
  cleanupScreenshots,
  MAX_SCREENSHOT_SIZE,
  SCREENSHOTS_DIR,
} from "../../src/utils.js";
import * as fs from "fs";
import * as path from "path";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import { PathLike } from "fs";

describe("utils", () => {
  describe("isValidUrl", () => {
    it("should validate correct http URLs", () => {
      expect(isValidUrl("http://example.com")).toBe(true);
      expect(isValidUrl("http://sub.example.com/path?query=1")).toBe(true);
    });

    it("should validate correct https URLs", () => {
      expect(isValidUrl("https://example.com")).toBe(true);
      expect(isValidUrl("https://sub.example.com/path?query=1")).toBe(true);
    });

    it("should reject invalid URLs", () => {
      expect(isValidUrl("not-a-url")).toBe(false);
      expect(isValidUrl("ftp://example.com")).toBe(false);
      expect(isValidUrl("")).toBe(false);
    });
  });

  describe("withRetry", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should succeed on first try", async () => {
      const operation = vi.fn().mockResolvedValue("success");
      const result = await withRetry(operation);
      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it("should retry on failure and succeed", async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error("fail"))
        .mockResolvedValueOnce("success");

      const promise = withRetry(operation);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it("should throw after max retries", async () => {
      const operation = vi.fn().mockRejectedValue(new Error("persistent failure"));

      const promise = withRetry(operation, 3);
      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow("persistent failure");
      expect(operation).toHaveBeenCalledTimes(3);
    });
  });

  describe("screenshot management", () => {
    const mockScreenshot = Buffer.from("test-screenshot").toString("base64");
    const mockTitle = "test-page";

    beforeEach(() => {
      vi.spyOn(fs.promises, "writeFile").mockResolvedValue(undefined);
      
      // Mock readdir with proper type overloads
      const mockReaddir = vi.fn((path: PathLike, options?: { withFileTypes?: boolean }) => {
        if (options?.withFileTypes) {
          const dirent = {
            name: "test.png",
            isFile: () => true,
            isDirectory: () => false,
            isSymbolicLink: () => false,
            isBlockDevice: () => false,
            isCharacterDevice: () => false,
            isFIFO: () => false,
            isSocket: () => false,
          } as fs.Dirent;
          return Promise.resolve([dirent]);
        }
        return Promise.resolve(["test.png"]);
      }) as unknown as typeof fs.promises.readdir;

      vi.spyOn(fs.promises, "readdir").mockImplementation(mockReaddir);
      vi.spyOn(fs.promises, "unlink").mockResolvedValue(undefined);
      vi.spyOn(fs.promises, "rmdir").mockResolvedValue(undefined);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    describe("saveScreenshot", () => {
      it("should save valid screenshots", async () => {
        const filepath = await saveScreenshot(mockScreenshot, mockTitle);
        expect(filepath).toContain(SCREENSHOTS_DIR);
        expect(filepath).toContain("test-page");
        expect(filepath).toMatch(/\.png$/);
        expect(fs.promises.writeFile).toHaveBeenCalled();
      });

      it("should throw on oversized screenshots", async () => {
        const largeScreenshot = Buffer.alloc(MAX_SCREENSHOT_SIZE + 1).toString("base64");
        await expect(saveScreenshot(largeScreenshot, mockTitle)).rejects.toThrow(McpError);
      });

      it("should sanitize filenames", async () => {
        const filepath = await saveScreenshot(mockScreenshot, "Test Page! @#$%");
        expect(filepath).toMatch(/test_page_/);
        expect(filepath).toMatch(/\.png$/);
      });
    });

    describe("cleanupScreenshots", () => {
      it("should remove all screenshots and directory", async () => {
        await cleanupScreenshots();
        expect(fs.promises.readdir).toHaveBeenCalledWith(SCREENSHOTS_DIR, { withFileTypes: false });
        expect(fs.promises.unlink).toHaveBeenCalled();
        expect(fs.promises.rmdir).toHaveBeenCalledWith(SCREENSHOTS_DIR);
      });

      it("should handle cleanup errors gracefully", async () => {
        vi.spyOn(fs.promises, "readdir").mockRejectedValue(new Error("read error"));
        await expect(cleanupScreenshots()).resolves.not.toThrow();
      });
    });
  });
});