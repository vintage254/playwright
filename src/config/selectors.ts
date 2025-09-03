import { Page, ElementHandle } from 'playwright';

/**
 * Facebook Element Selectors for Educational Automation
 * These selectors are used to identify Facebook elements for automation testing
 * NOTE: Facebook frequently changes their selectors, so these may need updates
 */

const FACEBOOK_SELECTORS = {
  // Login page selectors
  LOGIN: {
    email: '[name="email"]',
    password: '[name="pass"]',
    loginButton: '[name="login"]',
    loginForm: '#loginform',
    errorMessage: '[data-testid="royal_login_form"] div[role="alert"]'
  },

  // Navigation and main page
  NAVIGATION: {
    home: '[data-testid="blue_bar"] a[href*="/"]',
    profile: '[data-testid="blue_bar"] [data-testid="nav_menu_profile"]',
    notifications: '[data-testid="blue_bar"] [data-testid="notif_flyout_button"]',
    messages: '[data-testid="blue_bar"] [data-testid="mercurymessages"]'
  },

  // Group-related selectors
  GROUPS: {
    // Selectors for joining groups and answering questions
    joinButton: '[data-testid="group_mall_post_button"]',
    joinButtonAlt: 'div[role="button"]:has-text("Join Group")',
    joinButtonAlt2: 'div[role="button"]:has-text("Join")',
    postButton: '[data-testid="group_mall_post_button"]',
    postButtonAlt: 'div[role="button"]:has-text("Write something")',
    createPostButton: '[data-testid="status-attachment-mentions-input"]',
    membershipQuestions: '[data-testid="group_questions_card"]',
    submitQuestions: 'div[role="button"]:has-text("Submit")',
    skipQuestions: 'div[role="button"]:has-text("Skip")',

    // Selectors for group discovery
    JOINED_GROUP_ITEM: 'a[href*="/groups/"]',
    JOINED_GROUP_NAME: 'span',
    SEARCH_RESULT_ITEM: 'div[role="article"]',
    SEARCH_GROUP_NAME: 'a[href*="/groups/"] > span',
    SEARCH_MEMBER_COUNT: 'div > span:has-text("members")',
  },

  // Post creation selectors
  POST: {
    textArea: '[data-testid="status-attachment-mentions-input"]',
    textAreaAlt: 'div[role="textbox"][data-testid="status-attachment-mentions-input"]',
    textAreaAlt2: 'div[contenteditable="true"][role="textbox"]',
    photoVideoButton: '[data-testid="mwthreadcomposer-photo-video-attachment"]',
    fileInput: 'input[type="file"][accept*="image"]',
    postButton: '[data-testid="react-composer-post-button"]',
    postButtonAlt: 'div[role="button"]:has-text("Post")',
    privacyDropdown: '[data-testid="mwthreadcomposer-audience-selector"]',
    imageUpload: '[data-testid="media-sprout"]'
  },

  // Common popup and modal selectors
  POPUPS: {
    securityCheck: '[data-testid="checkpoint_title"]',
    captcha: '[data-testid="captcha"]',
    twoFactorAuth: '[data-testid="2fa"]',
    sessionTimeout: 'div:has-text("Your session has expired")',
    unusualActivity: 'div:has-text("unusual activity")',
    confirmationDialog: '[role="dialog"]',
    closeButton: '[aria-label="Close"]',
    continueButton: 'div[role="button"]:has-text("Continue")',
    okButton: 'div[role="button"]:has-text("OK")',
    cancelButton: 'div[role="button"]:has-text("Cancel")'
  },

  // Error and blocking indicators
  BLOCKS: {
    blocked: 'div:has-text("blocked")',
    restricted: 'div:has-text("restricted")',
    spamWarning: 'div:has-text("spam")',
    rateLimit: 'div:has-text("try again later")',
    loginRequired: 'div:has-text("log in")'
  },

  // Loading and progress indicators
  LOADING: {
    spinner: '[role="progressbar"]',
    loadingText: 'div:has-text("Loading")',
    skeleton: '[data-testid="placeholder-skeleton"]'
  }
};

/**
 * Selector utility functions
 */
const SELECTOR_UTILS = {
  /**
   * Get multiple possible selectors for an element
   * @param {string} category - Selector category (e.g., 'POST', 'GROUPS')
   * @param {string} element - Element name (e.g., 'textArea', 'joinButton')
   * @returns {string[]} Array of possible selectors
   */
  getMultipleSelectors(category: keyof typeof FACEBOOK_SELECTORS, element: string): string[] {
    const categorySelectors = FACEBOOK_SELECTORS[category] as { [key: string]: string };
    const baseSelector = categorySelectors?.[element];
    if (!baseSelector) return [];

    const alternatives: string[] = [];
    Object.keys(categorySelectors).forEach(key => {
      if (key.startsWith(element)) {
        alternatives.push(categorySelectors[key]);
      }
    });

    return alternatives.length > 0 ? alternatives : [baseSelector];
  },

  /**
   * Check if current page is Facebook
   * @param {Page} page - Playwright page object
   * @returns {boolean} True if on Facebook
   */
  isFacebookPage(page: Page): boolean {
    const url = page.url();
    return url.includes('facebook.com') || url.includes('fb.com');
  },

  /**
   * Wait for any of multiple selectors to appear
   * @param {Page} page - Playwright page object
   * @param {string[]} selectors - Array of selectors to wait for
   * @param {Object} options - Playwright wait options
   * @returns {Promise<ElementHandle>} First matching element
   */
  async waitForAnySelector(
    page: Page, 
    selectors: string[], 
    options: object = {}
  ): Promise<ElementHandle<SVGElement | HTMLElement> | null> {
    const promises = selectors.map(selector =>
      page.waitForSelector(selector, { ...options, timeout: 5000 }).catch(() => null)
    );

    const results = await Promise.allSettled(promises);
    const firstSuccess = results.find(
      (result): result is PromiseFulfilledResult<ElementHandle<SVGElement | HTMLElement>> => 
        result.status === 'fulfilled' && result.value !== null
    );

    if (firstSuccess) {
      return firstSuccess.value;
    }

    throw new Error(`None of the selectors were found: ${selectors.join(', ')}`);
  }
};

export {
  FACEBOOK_SELECTORS,
  SELECTOR_UTILS
};
