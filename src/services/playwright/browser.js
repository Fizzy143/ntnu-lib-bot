// browser.js
// 負責啟動 chromium 與 context

import { chromium } from 'playwright';

export async function launchBrowser(headless = true) {
  const effectiveHeadless = shouldForceHeadless(headless);
  const browser = await chromium.launch({ headless: effectiveHeadless });
  return browser;
}

function shouldForceHeadless(headless) {
  if (headless) {
    return true;
  }

  const hasDisplay = Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY);
  if (process.platform === 'linux' && !hasDisplay) {
    console.warn('[playwright] No DISPLAY detected; falling back to headless mode.');
    return true;
  }

  return false;
}

export async function createContext(browser) {
  const context = await browser.newContext();
  return context;
}

export async function createPage(context) {
  const page = await context.newPage();
  return page;
}
