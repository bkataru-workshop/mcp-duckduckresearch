import { type Browser, chromium } from "playwright";
import { afterAll, beforeAll } from "vitest";

let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch({
    headless: true,
  });
});

afterAll(async () => {
  if (browser) {
    await browser.close();
  }
});
