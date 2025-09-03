/**
 * Browser Configuration for Educational Facebook Automation
 * This configuration includes stealth settings to study automation detection
 */

import { chromium } from 'playwright';

const STEALTH_CONFIG = {
  // User agents for different scenarios
  userAgents: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36'
  ],
  
  // Viewport sizes to randomize
  viewports: [
    { width: 1366, height: 768 },
    { width: 1920, height: 1080 },
    { width: 1440, height: 900 },
    { width: 1536, height: 864 }
  ]
};

/**
 * Creates a stealth browser instance for educational testing
 * @param {Object} options - Configuration options
 * @returns {Promise<Browser>} Browser instance
 */
async function createStealthBrowser(options: { slowMo?: number } = {}) {
  const randomUserAgent = STEALTH_CONFIG.userAgents[
    Math.floor(Math.random() * STEALTH_CONFIG.userAgents.length)
  ];
  
  const randomViewport = STEALTH_CONFIG.viewports[
    Math.floor(Math.random() * STEALTH_CONFIG.viewports.length)
  ];

  const browser = await chromium.launch({
    headless: false, // Always run in headful mode for educational purposes
    slowMo: options.slowMo || 100, // Add delays between actions
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-features=TranslateUI',
      '--disable-ipc-flooding-protection',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
    ]
  });

  const context = await browser.newContext({
    userAgent: randomUserAgent,
    viewport: randomViewport,
    locale: 'en-US',
    timezoneId: 'America/New_York',
    permissions: ['geolocation', 'notifications'],
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Cache-Control': 'max-age=0'
    }
  });

  // Override webdriver detection
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
    
    // Override plugin array
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });
    
    // Override languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });
    
    // Override permissions
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) => (
      parameters.name === 'notifications' ?
        Promise.resolve({ state: Notification.permission } as unknown as PermissionStatus) :
        originalQuery(parameters)
    );
  });

  return { browser, context };
}

/**
 * Get browser configuration for Playwright
 * @param {Object} options - Configuration options
 * @returns {Object} Browser launch configuration
 */
function getBrowserConfig(options: { slowMo?: number } = {}) {
  return {
    headless: false, // Always run in headful mode for educational purposes
    slowMo: options.slowMo || 100, // Add delays between actions
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-features=TranslateUI',
      '--disable-ipc-flooding-protection',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
    ]
  };
}

export {
  createStealthBrowser,
  STEALTH_CONFIG,
  getBrowserConfig
};
