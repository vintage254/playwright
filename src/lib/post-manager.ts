/**
 * Facebook Post Manager for Educational Automation
 * Handles creating posts with text and image uploads for web developer marketing
 */

import path from 'path';
import fs from 'fs-extra';
import { Page } from 'playwright';
import { logger, DELAYS, TYPING, MOUSE, SCROLL, VALIDATION, ERROR_HANDLER } from './utils';
import { FACEBOOK_SELECTORS, SELECTOR_UTILS } from '../config/selectors';

interface PostData {
  message?: string;
  imagePaths?: string[];
  groupUrl?: string | null;
  waitForConfirmation?: boolean;
}

interface PostResult {
  success: boolean;
  message: string;
  timestamp: string;
  postData: PostData;
  error: string | null;
}

interface ClickResult {
  success: boolean;
  error?: string;
}

interface SamplePost {
    message: string;
    imagePaths: string[];
    waitForConfirmation: boolean;
}

class PostManager {
  page: Page;
  createdPosts: PostResult[];
  failedPosts: PostResult[];

  constructor(page: Page) {
    this.page = page;
    this.createdPosts = [];
    this.failedPosts = [];
  }

  /**
   * Create a post in a Facebook group
   * @param {Object} postData - Post configuration
   * @returns {Promise<Object>} Post result
   */
  async createPost(postData: PostData): Promise<PostResult> {
    const {
      message = '',
      imagePaths = [],
      groupUrl = null,
      waitForConfirmation = true
    } = postData;

    const result: PostResult = {
      success: false,
      message: '',
      timestamp: new Date().toISOString(),
      postData,
      error: null
    };

    try {
      logger.info('Starting post creation...');
      
      // Navigate to group if URL provided
      if (groupUrl) {
        await this.navigateToGroup(groupUrl);
      }

      // Find and click the post creation button
      const postButtonResult = await this.findAndClickPostButton();
      if (!postButtonResult.success) {
        result.error = postButtonResult.error ?? null;
        this.failedPosts.push(result);
        return result;
      }

      await DELAYS.medium();

      // Type the message
      if (message) {
        const messageResult = await this.typePostMessage(message);
        if (!messageResult.success) {
          result.error = messageResult.error ?? null;
          this.failedPosts.push(result);
          return result;
        }
      }

      // Upload images if provided
      if (imagePaths.length > 0) {
        const imageResult = await this.uploadImages(imagePaths);
        if (!imageResult.success) {
          result.error = imageResult.error ?? null;
          this.failedPosts.push(result);
          return result;
        }
      }

      await DELAYS.medium();

      // Submit the post
      const submitResult = await this.submitPost();
      if (!submitResult.success) {
        result.error = submitResult.error ?? null;
        this.failedPosts.push(result);
        return result;
      }

      // Wait for confirmation if requested
      if (waitForConfirmation) {
        const confirmed = await this.waitForPostConfirmation();
        if (confirmed) {
          result.success = true;
          result.message = 'Post created and confirmed successfully';
        } else {
          result.success = true;
          result.message = 'Post submitted but confirmation timeout';
        }
      } else {
        result.success = true;
        result.message = 'Post submitted successfully';
      }

      this.createdPosts.push(result);
      logger.info(`Post creation result: ${result.message}`);
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      if (error instanceof Error) {
        ERROR_HANDLER.handle(error, 'createPost', postData);
      }
      result.error = errorMessage;
      this.failedPosts.push(result);
      return result;
    }
  }

  /**
   * Navigate to a specific group page
   * @param {string} groupUrl - Group URL
   * @returns {Promise<void>}
   */
  async navigateToGroup(groupUrl: string): Promise<void> {
    try {
      logger.info(`Navigating to group: ${groupUrl}`);
      await this.page.goto(groupUrl, { waitUntil: 'networkidle' });
      await DELAYS.medium();
      
      // Scroll down a bit to load the page content
      await SCROLL.natural(this.page, 200);
    } catch (error) {
      if (error instanceof Error) {
        ERROR_HANDLER.handle(error, 'navigateToGroup', { groupUrl });
      }
      throw error;
    }
  }

  /**
   * Find and click the post creation button
   * @returns {Promise<Object>} Click result
   */
  async findAndClickPostButton(): Promise<ClickResult> {
    try {
      logger.info('Looking for post creation button...');

      // Multiple selectors for post button
      const postSelectors = [
        FACEBOOK_SELECTORS.GROUPS.createPostButton,
        FACEBOOK_SELECTORS.GROUPS.postButton,
        FACEBOOK_SELECTORS.GROUPS.postButtonAlt,
        'div[role="button"]:has-text("Write something")',
        'div[role="button"]:has-text("What\'s on your mind")',
        '[data-testid="status-attachment-mentions-input"]',
        'div[contenteditable="true"]',
        '[data-pagelet="FeedComposer"]'
      ];

      for (const selector of postSelectors) {
        try {
          if (await VALIDATION.isElementVisible(this.page, selector)) {
            logger.info(`Found post button: ${selector}`);
            
            // Scroll to button
            await SCROLL.toElement(this.page, selector);
            await DELAYS.short();
            
            // Click to open composer
            await MOUSE.humanClick(this.page, selector);
            await DELAYS.long();
            
            return { success: true };
          }
        } catch (error) {
          continue;
        }
      }

      return { success: false, error: 'Post creation button not found' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      if (error instanceof Error) {
        ERROR_HANDLER.handle(error, 'findAndClickPostButton');
      }
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Type the post message
   * @param {string} message - Message text
   * @returns {Promise<Object>} Typing result
   */
  async typePostMessage(message: string): Promise<ClickResult> {
    try {
      logger.info('Typing post message...');

      // Find the text input area
      const textSelectors = [
        FACEBOOK_SELECTORS.POST.textArea,
        FACEBOOK_SELECTORS.POST.textAreaAlt,
        FACEBOOK_SELECTORS.POST.textAreaAlt2,
        'div[role="textbox"][contenteditable="true"]',
        'textarea[placeholder*="mind"]',
        'div[data-testid="status-attachment-mentions-input"]'
      ];

      let textAreaFound = false;

      for (const selector of textSelectors) {
        try {
          if (await VALIDATION.isElementVisible(this.page, selector)) {
            logger.info(`Found text area: ${selector}`);
            
            // Clear any existing text first
            await this.page.click(selector);
            await DELAYS.short();
            
            // Select all and clear
            await this.page.keyboard.press('Control+a');
            await DELAYS.short();
            
            // Type the message with human-like behavior
            await TYPING.humanType(this.page, selector, message, {
              minDelay: 50,
              maxDelay: 150,
              mistakes: true,
              mistakeProbability: 0.01
            });
            
            textAreaFound = true;
            break;
          }
        } catch (error) {
          continue;
        }
      }

      if (!textAreaFound) {
        return { success: false, error: 'Text input area not found' };
      }

      await DELAYS.medium();
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      if (error instanceof Error) {
        ERROR_HANDLER.handle(error, 'typePostMessage');
      }
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Upload images to the post
   * @param {Array} imagePaths - Array of image file paths
   * @returns {Promise<Object>} Upload result
   */
  async uploadImages(imagePaths: string[]): Promise<ClickResult> {
    try {
      logger.info(`Uploading ${imagePaths.length} image(s)...`);

      // Validate image paths
      for (const imagePath of imagePaths) {
        if (!await fs.pathExists(imagePath)) {
          return { success: false, error: `Image not found: ${imagePath}` };
        }
      }

      // Find photo/video button
      const photoButtonSelectors = [
        FACEBOOK_SELECTORS.POST.photoVideoButton,
        '[data-testid="mwthreadcomposer-photo-video-attachment"]',
        'div[role="button"][aria-label*="Photo"]',
        'div[role="button"][aria-label*="photo"]',
        'input[type="file"][accept*="image"]'
      ];

      let photoButtonFound = false;

      for (const selector of photoButtonSelectors) {
        try {
          if (await VALIDATION.isElementVisible(this.page, selector)) {
            logger.info(`Found photo button: ${selector}`);
            
            if (selector.includes('input[type="file"]')) {
              // Direct file input
              await this.uploadToFileInput(selector, imagePaths);
            } else {
              // Click button to reveal file input
              await MOUSE.humanClick(this.page, selector);
              await DELAYS.medium();
              
              // Find the file input that appeared
              const fileInput = await this.findFileInput();
              if (fileInput) {
                await this.uploadToFileInput(fileInput, imagePaths);
              } else {
                continue;
              }
            }
            
            photoButtonFound = true;
            break;
          }
        } catch (error) {
          continue;
        }
      }

      if (!photoButtonFound) {
        return { success: false, error: 'Photo upload button not found' };
      }

      // Wait for images to upload
      await this.waitForImageUpload();
      
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      if (error instanceof Error) {
        ERROR_HANDLER.handle(error, 'uploadImages');
      }
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Find file input element
   * @returns {Promise<string|null>} File input selector
   */
  async findFileInput(): Promise<string | null> {
    const fileInputSelectors = [
      'input[type="file"][accept*="image"]',
      'input[type="file"]',
      FACEBOOK_SELECTORS.POST.fileInput
    ];

    for (const selector of fileInputSelectors) {
      if (await VALIDATION.isElementVisible(this.page, selector)) {
        return selector;
      }
    }

    return null;
  }

  /**
   * Upload files to file input
   * @param {string} selector - File input selector
   * @param {Array} imagePaths - Image file paths
   * @returns {Promise<void>}
   */
  async uploadToFileInput(selector: string, imagePaths: string[]): Promise<void> {
    try {
      // Convert to absolute paths
      const absolutePaths = imagePaths.map(p => path.resolve(p));
      
      logger.info(`Uploading to input: ${selector}`);
      logger.info(`Files: ${absolutePaths.join(', ')}`);
      
      await this.page.setInputFiles(selector, absolutePaths);
      await DELAYS.long();
    } catch (error) {
      if (error instanceof Error) {
        ERROR_HANDLER.handle(error, 'uploadToFileInput');
      }
      throw error;
    }
  }

  /**
   * Wait for image upload to complete
   * @returns {Promise<boolean>} Upload completion status
   */
  async waitForImageUpload(): Promise<boolean> {
    try {
      logger.info('Waiting for image upload to complete...');
      
      const maxWaitTime = 30000; // 30 seconds
      const startTime = Date.now();
      
      while (Date.now() - startTime < maxWaitTime) {
        // Check for upload completion indicators
        const uploadComplete = await this.page.locator('[data-testid="media-sprout"]').count() > 0 ||
                              await this.page.locator('.img').count() > 0 ||
                              !await VALIDATION.isElementVisible(this.page, FACEBOOK_SELECTORS.LOADING.spinner);
        
        if (uploadComplete) {
          logger.info('Image upload completed');
          return true;
        }
        
        await DELAYS.short();
      }
      
      logger.warn('Image upload timeout, proceeding anyway');
      return false;
    } catch (error) {
      if (error instanceof Error) {
        ERROR_HANDLER.handle(error, 'waitForImageUpload');
      }
      return false;
    }
  }

  /**
   * Submit the post
   * @returns {Promise<Object>} Submit result
   */
  async submitPost(): Promise<ClickResult> {
    try {
      logger.info('Submitting post...');

      const postButtonSelectors = [
        FACEBOOK_SELECTORS.POST.postButton,
        FACEBOOK_SELECTORS.POST.postButtonAlt,
        'div[role="button"]:has-text("Post")',
        'div[role="button"]:has-text("Share")',
        '[data-testid="react-composer-post-button"]'
      ];

      for (const selector of postButtonSelectors) {
        try {
          if (await VALIDATION.isElementVisible(this.page, selector)) {
            logger.info(`Found post submit button: ${selector}`);
            
            // Human-like click
            await MOUSE.humanClick(this.page, selector);
            await DELAYS.long();
            
            return { success: true };
          }
        } catch (error) {
          continue;
        }
      }

      return { success: false, error: 'Post submit button not found' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      if (error instanceof Error) {
        ERROR_HANDLER.handle(error, 'submitPost');
      }
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Wait for post confirmation
   * @returns {Promise<boolean>} Confirmation status
   */
  async waitForPostConfirmation(): Promise<boolean> {
    try {
      logger.info('Waiting for post confirmation...');
      
      const maxWaitTime = 20000; // 20 seconds
      const startTime = Date.now();
      
      while (Date.now() - startTime < maxWaitTime) {
        // Check for success indicators
        const posted = await VALIDATION.isElementVisible(this.page, 'div:has-text("Your post is now published")') ||
                      await VALIDATION.isElementVisible(this.page, 'div:has-text("Posted")') ||
                      !await VALIDATION.isElementVisible(this.page, FACEBOOK_SELECTORS.LOADING.spinner);
        
        if (posted) {
          logger.info('Post confirmation received');
          return true;
        }
        
        await DELAYS.short();
      }
      
      return false;
    } catch (error) {
      if (error instanceof Error) {
        ERROR_HANDLER.handle(error, 'waitForPostConfirmation');
      }
      return false;
    }
  }

  /**
   * Get created posts history
   * @returns {Array} Created posts
   */
  getCreatedPosts(): PostResult[] {
    return [...this.createdPosts];
  }

  /**
   * Get failed posts history
   * @returns {Array} Failed posts
   */
  getFailedPosts(): PostResult[] {
    return [...this.failedPosts];
  }

  /**
   * Reset tracking arrays
   */
  reset() {
    this.createdPosts = [];
    this.failedPosts = [];
    logger.info('Post manager reset');
  }

  /**
   * Create sample web developer marketing post
   * @returns {Object} Sample post data
   */
  static createSampleWebDevPost(): SamplePost {
    const messages = [
      "🚀 Professional Web Developer Available for Projects!\n\nSpecializing in:\n✅ Landing Pages & Portfolios\n✅ Blog Pages & Content Sites\n✅ E-commerce Shops & Stores\n✅ Business Portals & Dashboards\n✅ React & Next.js Applications\n\n💰 Starting from as low as $50!\n\nLet's build something amazing together! 💻\n\n#WebDeveloper #LandingPages #Ecommerce #BlogDesign",
      
      "💼 Looking to grow your business online?\n\nI create:\n🌟 High-Converting Landing Pages\n🌟 Professional Blog Websites\n🌟 E-commerce Shops & Online Stores\n🌟 Custom Business Portals\n🌟 Mobile-Responsive Designs\n\n💰 Affordable rates starting from just $50!\n\nPortfolio and references available!\n\n#WebDesign #Ecommerce #LandingPage #BlogDevelopment",
      
      "🎯 Full-Stack Developer Ready for Your Next Project!\n\nServices:\n📱 Landing Pages & Sales Funnels\n📝 Blog Pages & CMS Solutions\n🛒 E-commerce Shops & Payment Integration\n🏢 Business Portals & Admin Dashboards\n⚡ Fast & Secure Websites\n\n💰 Quality work starting from as low as $50!\n\nFree consultation available! DM me 📩\n\n#FullStack #EcommerceShop #Portal #BlogWebsite"
    ];

    // Use @assets alias for image paths
    const imagePaths = [
      path.resolve(process.cwd(), 'public/assets/post1.jpeg'),
      path.resolve(process.cwd(), 'public/assets/post2.jpeg')
    ];

    return {
      message: messages[Math.floor(Math.random() * messages.length)],
      imagePaths: imagePaths,
      waitForConfirmation: true
    };
  }
}

export default PostManager;
