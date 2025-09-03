/**
 * Utility Functions for Human-like Automation
 * Educational purposes - studying automation detection patterns
 */

import winston from 'winston';
import { Page } from 'playwright';

/**
 * Configure logger for automation activities
 */
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'facebook-automation' },
  transports: [
    new winston.transports.File({ filename: './logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: './logs/automation.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

/**
 * Human-like delay functions
 */
const DELAYS = {
  /**
   * Random delay between min and max milliseconds
   * @param {number} min - Minimum delay in ms
   * @param {number} max - Maximum delay in ms
   * @returns {Promise<void>}
   */
  async random(min = 1000, max = 3000) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    logger.info(`Waiting ${delay}ms for human-like behavior`);
    await new Promise(resolve => setTimeout(resolve, delay));
  },

  /**
   * Short delay for quick actions
   * @returns {Promise<void>}
   */
  async short() {
    await this.random(500, 1500);
  },

  /**
   * Medium delay for normal actions
   * @returns {Promise<void>}
   */
  async medium() {
    await this.random(1500, 3500);
  },

  /**
   * Long delay for heavy actions
   * @returns {Promise<void>}
   */
  async long() {
    await this.random(3000, 6000);
  },

  /**
   * Reading delay - simulates time to read content
   * @param {string} text - Text being "read"
   * @returns {Promise<void>}
   */
  async reading(text = '') {
    const baseTime = 1000;
    const wordsPerMinute = 200; // Average reading speed
    const wordCount = text.split(' ').length;
    const readingTime = (wordCount / wordsPerMinute) * 60 * 1000;
    const totalTime = Math.max(baseTime, readingTime);
    
    logger.info(`Simulating reading time: ${Math.round(totalTime)}ms for ${wordCount} words`);
    await new Promise(resolve => setTimeout(resolve, totalTime));
  }
};

/**
 * Human-like typing simulation
 */
interface TypingOptions {
  minDelay?: number;
  maxDelay?: number;
  mistakes?: boolean;
  mistakeProbability?: number;
}

const TYPING = {
  /**
   * Type text with human-like delays between characters
   * @param {Page} page - Playwright page object
   * @param {string} selector - Element selector
   * @param {string} text - Text to type
   * @param {Object} options - Typing options
   * @returns {Promise<void>}
   */
  async humanType(page: Page, selector: string, text: string, options: TypingOptions = {}): Promise<void> {
    const {
      minDelay = 50,
      maxDelay = 200,
      mistakes = true,
      mistakeProbability = 0.02
    } = options;

    await page.click(selector);
    await DELAYS.short();

    const chars = text.split('');
    let typedText = '';

    for (let i = 0; i < chars.length; i++) {
      const char = chars[i];
      
      // Simulate typing mistakes occasionally
      if (mistakes && Math.random() < mistakeProbability && char !== ' ') {
        const wrongChar = String.fromCharCode(char.charCodeAt(0) + 1);
        await page.keyboard.type(wrongChar);
        await this.randomDelay(minDelay, maxDelay);
        
        // Realize mistake and backspace
        await page.keyboard.press('Backspace');
        await this.randomDelay(minDelay * 2, maxDelay * 2);
      }
      
      // Type the correct character
      await page.keyboard.type(char);
      typedText += char;
      
      // Variable delay between characters
      if (char === ' ') {
        await this.randomDelay(minDelay * 2, maxDelay * 2); // Longer pause at spaces
      } else if (char === '.' || char === '!' || char === '?') {
        await this.randomDelay(minDelay * 3, maxDelay * 3); // Pause at sentence endings
      } else {
        await this.randomDelay(minDelay, maxDelay);
      }
    }

    logger.info(`Human-typed text: "${text}"`);
  },

  /**
   * Random delay for typing
   * @param {number} min - Minimum delay
   * @param {number} max - Maximum delay
   * @returns {Promise<void>}
   */
  async randomDelay(min: number, max: number): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
};

/**
 * Mouse movement simulation
 */
const MOUSE = {
  /**
   * Move mouse to element with human-like path
   * @param {Page} page - Playwright page object
   * @param {string} selector - Element selector
   * @returns {Promise<void>}
   */
  async moveToElement(page: Page, selector: string): Promise<void> {
    const element = await page.locator(selector);
    const box = await element.boundingBox();
    
    if (box) {
      // Add some randomness to click position
      const x = box.x + box.width * (0.3 + Math.random() * 0.4);
      const y = box.y + box.height * (0.3 + Math.random() * 0.4);
      
      await page.mouse.move(x, y, { steps: Math.floor(Math.random() * 10) + 5 });
      await DELAYS.random(100, 300);
    }
  },

  /**
   * Click element with human-like behavior
   * @param {Page} page - Playwright page object
   * @param {string} selector - Element selector
   * @returns {Promise<void>}
   */
  async humanClick(page: Page, selector: string): Promise<void> {
    await this.moveToElement(page, selector);
    await page.click(selector);
    logger.info(`Human-clicked element: ${selector}`);
  }
};

/**
 * Scroll simulation
 */
const SCROLL = {
  /**
   * Scroll page naturally
   * @param {Page} page - Playwright page object
   * @param {number} distance - Scroll distance
   * @returns {Promise<void>}
   */
  async natural(page: Page, distance: number = 300): Promise<void> {
    const steps = Math.floor(distance / 50);
    
    for (let i = 0; i < steps; i++) {
      await page.mouse.wheel(0, 50);
      await DELAYS.random(50, 150);
    }
    
    logger.info(`Natural scroll: ${distance}px in ${steps} steps`);
  },

  /**
   * Scroll to element smoothly
   * @param {Page} page - Playwright page object
   * @param {string} selector - Element selector
   * @returns {Promise<void>}
   */
  async toElement(page: Page, selector: string): Promise<void> {
    await page.locator(selector).scrollIntoViewIfNeeded();
    await DELAYS.short();
    logger.info(`Scrolled to element: ${selector}`);
  }
};

/**
 * Validation utilities
 */
interface WaitForChangeOptions {
  timeout?: number;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
}

const VALIDATION = {
  /**
   * Check if element exists and is visible
   * @param {Page} page - Playwright page object
   * @param {string} selector - Element selector
   * @returns {Promise<boolean>}
   */
  async isElementVisible(page: Page, selector: string): Promise<boolean> {
    try {
      const element = await page.locator(selector);
      return await element.isVisible();
    } catch (error) {
      return false;
    }
  },

  /**
   * Wait for navigation or content change
   * @param {Page} page - Playwright page object
   * @param {Object} options - Wait options
   * @returns {Promise<void>}
   */
  async waitForChange(page: Page, options: WaitForChangeOptions = {}): Promise<void> {
    const { timeout = 10000, waitUntil = 'networkidle' } = options;
    
    try {
      await page.waitForLoadState(waitUntil, { timeout });
      await DELAYS.medium();
    } catch (error) {
      logger.warn('Page load timeout, continuing anyway');
    }
  }
};

/**
 * Error handling utilities
 */
interface ErrorData {
  [key: string]: any;
}

const ERROR_HANDLER = {
  /**
   * Handle and log automation errors
   * @param {Error} error - Error object
   * @param {string} context - Context where error occurred
   * @param {Object} data - Additional error data
   */
  handle(error: Error, context: string, data: ErrorData = {}): void {
    logger.error(`Automation error in ${context}:`, {
      message: error.message,
      stack: error.stack,
      context,
      ...data
    });
  },

  /**
   * Check if error is recoverable
   * @param {Error} error - Error object
   * @returns {boolean}
   */
  isRecoverable(error: Error): boolean {
    const recoverableErrors = [
      'timeout',
      'navigation',
      'network',
      'element not found'
    ];
    
    return recoverableErrors.some(type => 
      error.message.toLowerCase().includes(type)
    );
  }
};

export {
  logger,
  DELAYS,
  TYPING,
  MOUSE,
  SCROLL,
  VALIDATION,
  ERROR_HANDLER
};
