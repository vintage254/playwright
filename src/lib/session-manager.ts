/**
 * Session Management for Facebook Automation
 * Handles saving and loading of login sessions to avoid repeated logins
 */

import fs from 'fs-extra';
import path from 'path';
import { BrowserContext, Page, Cookie } from 'playwright';
import { logger, DELAYS, VALIDATION, ERROR_HANDLER } from './utils';
import { FACEBOOK_SELECTORS } from '../config/selectors';

interface SessionData {
  cookies: Cookie[];
  localStorage: { [key: string]: string };
  sessionStorage: { [key: string]: string };
  url: string;
  timestamp: string;
  userAgent: string;
}

class SessionManager {
  sessionFile: string;
  session: SessionData | null;

  constructor(sessionFile = 'fb-session.json') {
    this.sessionFile = path.resolve(sessionFile);
    this.session = null;
  }

  /**
   * Save current browser session to file
   * @param {BrowserContext} context - Playwright browser context
   * @param {Page} page - Current page
   * @returns {Promise<boolean>} Success status
   */
  async saveSession(context: BrowserContext, page: Page): Promise<boolean> {
    try {
      logger.info('Saving Facebook session...');
      
      // Get cookies
      const cookies = await context.cookies();
      
      // Get localStorage data
      const localStorage = await page.evaluate(() => {
        const data: { [key: string]: string } = {};
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key) {
            const value = window.localStorage.getItem(key);
            if (value) {
              data[key] = value;
            }
          }
        }
        return data;
      });

      // Get sessionStorage data
      const sessionStorage = await page.evaluate(() => {
        const data: { [key: string]: string } = {};
        for (let i = 0; i < window.sessionStorage.length; i++) {
          const key = window.sessionStorage.key(i);
          if (key) {
            const value = window.sessionStorage.getItem(key);
            if (value) {
              data[key] = value;
            }
          }
        }
        return data;
      });

      const sessionData = {
        cookies,
        localStorage,
        sessionStorage,
        url: page.url(),
        timestamp: new Date().toISOString(),
        userAgent: await page.evaluate(() => navigator.userAgent)
      };

      await fs.writeJson(this.sessionFile, sessionData, { spaces: 2 });
      this.session = sessionData;
      
      logger.info(`Session saved successfully to ${this.sessionFile}`);
      return true;
    } catch (error) {
      if (error instanceof Error) {
        ERROR_HANDLER.handle(error, 'saveSession');
      }
      return false;
    }
  }

  /**
   * Load session from file and restore to browser
   * @param {BrowserContext} context - Playwright browser context
   * @param {Page} page - Current page
   * @returns {Promise<boolean>} Success status
   */
  async loadSession(context: BrowserContext, page: Page): Promise<boolean> {
    try {
      if (!await fs.pathExists(this.sessionFile)) {
        logger.info('No existing session file found');
        return false;
      }

      logger.info('Loading Facebook session...');
      const sessionData: SessionData = await fs.readJson(this.sessionFile);
      
      // Check if session is too old (older than 24 hours)
      const sessionAge = Date.now() - new Date(sessionData.timestamp).getTime();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      
      if (sessionAge > maxAge) {
        logger.warn('Session is too old, will require fresh login');
        return false;
      }

      // Add cookies to context
      if (sessionData.cookies && sessionData.cookies.length > 0) {
        await context.addCookies(sessionData.cookies);
      }

      // Navigate to Facebook first
      await page.goto('https://www.facebook.com', { waitUntil: 'networkidle' });
      await DELAYS.medium();

      // Restore localStorage
      if (sessionData.localStorage) {
        await page.evaluate((data) => {
          for (const [key, value] of Object.entries(data)) {
            try {
              window.localStorage.setItem(key, value as string);
            } catch (e) {
              console.warn('Failed to set localStorage item:', key);
            }
          }
        }, sessionData.localStorage);
      }

      // Restore sessionStorage
      if (sessionData.sessionStorage) {
        await page.evaluate((data) => {
          for (const [key, value] of Object.entries(data)) {
            try {
              window.sessionStorage.setItem(key, value as string);
            } catch (e) {
              console.warn('Failed to set sessionStorage item:', key);
            }
          }
        }, sessionData.sessionStorage);
      }

      // Refresh page to apply session data
      await page.reload({ waitUntil: 'networkidle' });
      await DELAYS.long();

      // Verify we're logged in
      const isLoggedIn = await this.verifyLogin(page);
      
      if (isLoggedIn) {
        logger.info('Session restored successfully');
        this.session = sessionData;
        return true;
      } else {
        logger.warn('Session restoration failed - login required');
        return false;
      }
    } catch (error) {
      if (error instanceof Error) {
        ERROR_HANDLER.handle(error, 'loadSession');
      }
      return false;
    }
  }

  /**
   * Verify if user is currently logged in to Facebook
   * @param {Page} page - Current page
   * @returns {Promise<boolean>} Login status
   */
  async verifyLogin(page: Page): Promise<boolean> {
    try {
      await DELAYS.short();
      
      // Check for login form (indicates not logged in)
      const loginForm = await VALIDATION.isElementVisible(page, FACEBOOK_SELECTORS.LOGIN.loginForm);
      if (loginForm) {
        return false;
      }

      // Check for common logged-in elements
      const loggedInIndicators = [
        '[data-testid="blue_bar"]', // Top navigation bar
        '[role="banner"]', // Header banner
        '[data-testid="news_feed"]', // News feed
        '[data-testid="left_nav_menu"]' // Left navigation menu
      ];

      for (const selector of loggedInIndicators) {
        if (await VALIDATION.isElementVisible(page, selector)) {
          logger.info('Login verification successful');
          return true;
        }
      }

      // Check URL patterns that indicate login
      const url = page.url();
      const loggedInUrls = [
        'facebook.com/home',
        'facebook.com/?sk=',
        'facebook.com/profile'
      ];

      for (const pattern of loggedInUrls) {
        if (url.includes(pattern)) {
          logger.info('Login verified by URL pattern');
          return true;
        }
      }

      return false;
    } catch (error) {
      if (error instanceof Error) {
        ERROR_HANDLER.handle(error, 'verifyLogin');
      }
      return false;
    }
  }

  /**
   * Perform manual login (requires user interaction)
   * @param {Page} page - Current page
   * @returns {Promise<boolean>} Login success
   */
  async performLogin(page: Page): Promise<boolean> {
    try {
      logger.info('Manual login required...');
      
      // Navigate to Facebook login page
      await page.goto('https://www.facebook.com/login', { waitUntil: 'networkidle' });
      await DELAYS.medium();

      // Check if already logged in
      if (await this.verifyLogin(page)) {
        logger.info('Already logged in');
        return true;
      }

      // Display login instructions
      console.log('\n=== MANUAL LOGIN REQUIRED ===');
      console.log('Please complete the login process in the browser window.');
      console.log('The automation will continue once login is detected.');
      console.log('===============================\n');

      // Wait for login completion (check every 5 seconds)
      const maxWaitTime = 300000; // 5 minutes
      const checkInterval = 5000; // 5 seconds
      let waitTime = 0;

      while (waitTime < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        waitTime += checkInterval;

        if (await this.verifyLogin(page)) {
          logger.info('Manual login completed successfully');
          await DELAYS.medium();
          return true;
        }

        // Log progress every 30 seconds
        if (waitTime % 30000 === 0) {
          console.log(`Waiting for login... (${waitTime / 1000}s elapsed)`);
        }
      }
      
      logger.error('Login timeout - manual login not completed within time limit');
      return false;
    } catch (error) {
      if (error instanceof Error) {
        ERROR_HANDLER.handle(error, 'performLogin');
      }
      return false;
    }
  }

  /**
   * Get current session information
   * @returns {SessionData | null} Session data or null
   */
  getSessionInfo(): SessionData | null {
    return this.session;
  }

  /**
   * Check if session exists and is valid
   * @returns {Promise<boolean>} Session validity
   */
  async hasValidSession(): Promise<boolean> {
    try {
      if (!await fs.pathExists(this.sessionFile)) {
        return false;
      }

      const sessionData: SessionData = await fs.readJson(this.sessionFile);
      const sessionAge = Date.now() - new Date(sessionData.timestamp).getTime();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      return sessionAge <= maxAge;
    } catch (error) {
      return false;
    }
  }
}

export default SessionManager;
