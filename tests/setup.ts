import { afterAll, beforeAll } from "vitest";
import { chromium, Browser } from "playwright";

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