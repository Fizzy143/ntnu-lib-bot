// browser.js
// 負責啟動 chromium 與 context

import { chromium } from 'playwright';

export async function launchBrowser(headless = true) {
  const browser = await chromium.launch({ headless });
  return browser;
}

export async function createContext(browser) {
  const context = await browser.newContext();
  return context;
}

export async function createPage(context) {
  const page = await context.newPage();
  return page;
}
