/**
 * Facebook Group Management for Educational Automation
 * Handles joining groups and managing membership questions
 */

import { Page, Locator } from 'playwright';
import { logger, DELAYS, TYPING, MOUSE, SCROLL, VALIDATION, ERROR_HANDLER } from './utils';
import { FACEBOOK_SELECTORS, SELECTOR_UTILS } from '../config/selectors';

interface JoinGroupOptions {
  skipQuestions?: boolean;
  questionAnswers?: { [key: string]: string };
  maxWaitTime?: number;
}

interface GroupJoinResult {
  url: string;
  success: boolean;
  status: string;
  message: string;
  timestamp: string;
}

interface GroupStatus {
  blocked: boolean;
  reason?: string;
}

interface MembershipStatus {
  isMember: boolean;
}

interface ClickResult {
  success: boolean;
  error?: string;
}

interface HandleQuestionsResult {
  success: boolean;
  error?: string;
}

class GroupManager {
  page: Page;
  joinedGroups: GroupJoinResult[];
  failedGroups: GroupJoinResult[];

  constructor(page: Page) {
    this.page = page;
    this.joinedGroups = [];
    this.failedGroups = [];
  }

  /**
   * Join a Facebook group by URL
   * @param {string} groupUrl - Facebook group URL
   * @param {Object} options - Join options
   * @returns {Promise<Object>} Join result
   */
  async joinGroup(groupUrl: string, options: JoinGroupOptions = {}): Promise<GroupJoinResult> {
    const {
      skipQuestions = false,
      questionAnswers = {},
      maxWaitTime = 30000
    } = options;

    const result = {
      url: groupUrl,
      success: false,
      status: 'pending',
      message: '',
      timestamp: new Date().toISOString()
    };

    try {
      logger.info(`Attempting to join group: ${groupUrl}`);
      
      // Navigate to group page
      await this.page.goto(groupUrl, { waitUntil: 'networkidle' });
      await DELAYS.medium();

      // Check if group exists and is accessible
      const groupStatus = await this.checkGroupStatus();
      if (groupStatus.blocked) {
        result.status = 'blocked';
        result.message = groupStatus.reason || 'Group is blocked or private';
        this.failedGroups.push(result);
        return result;
      }

      // Check if already a member
      const membershipStatus = await this.checkMembershipStatus();
      if (membershipStatus.isMember) {
        result.success = true;
        result.status = 'already_member';
        result.message = 'Already a member of this group';
        this.joinedGroups.push(result);
        return result;
      }

      // Find and click join button
      const joinResult = await this.clickJoinButton();
      if (!joinResult.success) {
        result.status = 'join_failed';
        result.message = joinResult.error || 'Join button not found';
        this.failedGroups.push(result);
        return result;
      }

      await DELAYS.medium();

      // Handle membership questions if they appear
      const questionsHandled = await this.handleMembershipQuestions(skipQuestions, questionAnswers);
      if (!questionsHandled.success) {
        result.status = 'questions_failed';
        result.message = questionsHandled.error || 'Failed to handle membership questions';
        this.failedGroups.push(result);
        return result;
      }

      // Wait for join confirmation
      const joinConfirmed = await this.waitForJoinConfirmation(maxWaitTime);
      if (joinConfirmed) {
        result.success = true;
        result.status = 'joined';
        result.message = 'Successfully joined group';
        this.joinedGroups.push(result);
      } else {
        result.status = 'pending_approval';
        result.message = 'Join request submitted, awaiting approval';
        // Still consider this a success as the request was submitted
        result.success = true;
        this.joinedGroups.push(result);
      }

      logger.info(`Group join result: ${result.status} - ${result.message}`);
      return result;

    } catch (error) {
      if (error instanceof Error) {
        ERROR_HANDLER.handle(error, 'joinGroup', { groupUrl });
        result.message = error.message;
      } else {
        result.message = 'An unknown error occurred';
      }
      result.status = 'error';
      this.failedGroups.push(result);
      return result;
    }
  }

  /**
   * Check if group is accessible and not blocked
   * @returns {Promise<Object>} Group status
   */
  async checkGroupStatus(): Promise<GroupStatus> {
    try {
      await DELAYS.short();

      // Check for various blocking scenarios
      const blockIndicators = [
        { selector: FACEBOOK_SELECTORS.BLOCKS.blocked, reason: 'Group is blocked or private' },
        { selector: FACEBOOK_SELECTORS.BLOCKS.restricted, reason: 'Access restricted' },
        { selector: 'div:has-text("This content isn\'t available")', reason: 'Group not found or deleted' },
        { selector: 'div:has-text("Private group")', reason: 'Private group - access denied' }
      ];

      for (const indicator of blockIndicators) {
        if (await VALIDATION.isElementVisible(this.page, indicator.selector)) {
          logger.warn(`Group access blocked: ${indicator.reason}`);
          return { blocked: true, reason: indicator.reason };
        }
      }

      // Check if page loaded properly
      const groupLoaded = await VALIDATION.isElementVisible(this.page, '[role="main"]');
      if (!groupLoaded) {
        return { blocked: true, reason: 'Group page failed to load' };
      }

      return { blocked: false };
    } catch (error) {
      if (error instanceof Error) {
        ERROR_HANDLER.handle(error, 'checkGroupStatus');
      }
      return { blocked: true, reason: 'Error checking group status' };
    }
  }

  /**
   * Check current membership status
   * @returns {Promise<Object>} Membership status
   */
  async checkMembershipStatus(): Promise<MembershipStatus> {
    try {
      await DELAYS.short();

      // Look for indicators that user is already a member
      const memberIndicators = [
        'div[role="button"]:has-text("Write something")',
        '[data-testid="group_mall_post_button"]',
        'div:has-text("You\'re a member")',
        'div[role="button"]:has-text("Leave Group")'
      ];

      for (const selector of memberIndicators) {
        if (await VALIDATION.isElementVisible(this.page, selector)) {
          logger.info('Already a member of this group');
          return { isMember: true };
        }
      }

      return { isMember: false };
    } catch (error) {
      if (error instanceof Error) {
        ERROR_HANDLER.handle(error, 'checkMembershipStatus');
      }
      return { isMember: false };
    }
  }

  /**
   * Find and click the join button
   * @returns {Promise<Object>} Click result
   */
  async clickJoinButton(): Promise<ClickResult> {
    try {
      // Multiple possible selectors for join button
      const joinSelectors = SELECTOR_UTILS.getMultipleSelectors('GROUPS', 'joinButton');
      
      // Add additional join button variations
      joinSelectors.push(
        'div[role="button"]:has-text("Join Group")',
        'div[role="button"]:has-text("Join")',
        'div[role="button"]:has-text("Request to Join")',
        '[aria-label="Join Group"]',
        '[aria-label="Join"]'
      );

      logger.info('Looking for join button...');
      
      for (const selector of joinSelectors) {
        try {
          if (await VALIDATION.isElementVisible(this.page, selector)) {
            logger.info(`Found join button: ${selector}`);
            
            // Scroll to button if needed
            await SCROLL.toElement(this.page, selector);
            await DELAYS.short();
            
            // Human-like click
            await MOUSE.humanClick(this.page, selector);
            await DELAYS.medium();
            
            return { success: true };
          }
        } catch (error) {
          // Continue trying other selectors
          continue;
        }
      }

      return { success: false, error: 'Join button not found' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      if (error instanceof Error) {
        ERROR_HANDLER.handle(error, 'clickJoinButton');
      }
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Handle membership questions if they appear
   * @param {boolean} skipQuestions - Whether to skip questions
   * @param {Object} questionAnswers - Predefined answers
   * @returns {Promise<Object>} Handling result
   */
  async handleMembershipQuestions(skipQuestions = false, questionAnswers: { [key: string]: string } = {}): Promise<HandleQuestionsResult> {
    try {
      await DELAYS.medium();
      
      // Check if membership questions dialog appeared
      const questionsVisible = await VALIDATION.isElementVisible(
        this.page, 
        FACEBOOK_SELECTORS.GROUPS.membershipQuestions
      );

      if (!questionsVisible) {
        logger.info('No membership questions found');
        return { success: true };
      }

      logger.info('Membership questions detected');

      if (skipQuestions) {
        return await this.skipQuestions();
      } else {
        return await this.answerQuestions(questionAnswers);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      if (error instanceof Error) {
        ERROR_HANDLER.handle(error, 'handleMembershipQuestions');
      }
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Skip membership questions
   * @returns {Promise<Object>} Skip result
   */
  async skipQuestions(): Promise<HandleQuestionsResult> {
    try {
      const skipButton = await VALIDATION.isElementVisible(
        this.page, 
        FACEBOOK_SELECTORS.GROUPS.skipQuestions
      );

      if (skipButton) {
        await MOUSE.humanClick(this.page, FACEBOOK_SELECTORS.GROUPS.skipQuestions);
        await DELAYS.medium();
        logger.info('Membership questions skipped');
        return { success: true };
      } else {
        // If no skip option, try to submit with empty answers
        return await this.submitQuestions();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      if (error instanceof Error) {
        ERROR_HANDLER.handle(error, 'skipQuestions');
      }
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Answer membership questions with provided answers
   * @param {Object} questionAnswers - Question-answer pairs
   * @returns {Promise<Object>} Answer result
   */
  async answerQuestions(questionAnswers: { [key: string]: string }): Promise<HandleQuestionsResult> {
    try {
      // Find all question text areas
      const questionInputs: Locator[] = await this.page.locator('textarea, input[type="text"]').all();
      
      if (questionInputs.length === 0) {
        logger.info('No question inputs found, attempting to submit');
        return await this.submitQuestions();
      }

      // Default answers for common questions
      const defaultAnswers: { [key: number]: string } = {
        0: "I'm interested in joining this community to learn and share experiences.",
        1: "Web developer looking to connect with like-minded professionals.",
        2: "I will follow all group rules and contribute positively.",
        ...questionAnswers // Override with provided answers
      };

      // Answer each question
      for (let i = 0; i < questionInputs.length; i++) {
        const input = questionInputs[i];
        const answer = defaultAnswers[i] || `Answer to question ${i + 1}`;
        
        logger.info(`Answering question ${i + 1}: ${answer}`);
        
        // Focus and type answer
        await input.click();
        await DELAYS.short();
        await input.fill(answer);
        await DELAYS.short();
      }

      // Submit the questions
      return await this.submitQuestions();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      if (error instanceof Error) {
        ERROR_HANDLER.handle(error, 'answerQuestions');
      }
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Submit membership questions
   * @returns {Promise<Object>} Submit result
   */
  async submitQuestions(): Promise<HandleQuestionsResult> {
    try {
      const submitButton = await VALIDATION.isElementVisible(
        this.page, 
        FACEBOOK_SELECTORS.GROUPS.submitQuestions
      );

      if (submitButton) {
        await MOUSE.humanClick(this.page, FACEBOOK_SELECTORS.GROUPS.submitQuestions);
        await DELAYS.long();
        logger.info('Membership questions submitted');
        return { success: true };
      } else {
        // Look for alternative submit buttons
        const alternativeSubmits = [
          'div[role="button"]:has-text("Submit")',
          'div[role="button"]:has-text("Send")',
          'div[role="button"]:has-text("Continue")'
        ];

        for (const selector of alternativeSubmits) {
          if (await VALIDATION.isElementVisible(this.page, selector)) {
            await MOUSE.humanClick(this.page, selector);
            await DELAYS.long();
            logger.info('Questions submitted with alternative button');
            return { success: true };
          }
        }

        return { success: false, error: 'Submit button not found' };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      if (error instanceof Error) {
        ERROR_HANDLER.handle(error, 'submitQuestions');
      }
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Wait for join confirmation
   * @param {number} maxWaitTime - Maximum time to wait
   * @returns {Promise<boolean>} Whether join was confirmed
   */
  async waitForJoinConfirmation(maxWaitTime = 30000): Promise<boolean> {
    try {
      const startTime = Date.now();
      
      while (Date.now() - startTime < maxWaitTime) {
        // Check for success indicators
        const successIndicators = [
          'div:has-text("Welcome to the group")',
          'div:has-text("You joined")',
          'div:has-text("Request sent")',
          '[data-testid="group_mall_post_button"]'
        ];

        for (const selector of successIndicators) {
          if (await VALIDATION.isElementVisible(this.page, selector)) {
            return true;
          }
        }

        await DELAYS.short();
      }

      return false;
    } catch (error) {
      if (error instanceof Error) {
        ERROR_HANDLER.handle(error, 'waitForJoinConfirmation');
      }
      return false;
    }
  }

  /**
   * Get list of successfully joined groups
   * @returns {Array} Joined groups
   */
  getJoinedGroups(): GroupJoinResult[] {
    return [...this.joinedGroups];
  }

  /**
   * Get list of failed group join attempts
   * @returns {Array} Failed groups
   */
  getFailedGroups(): GroupJoinResult[] {
    return [...this.failedGroups];
  }

  /**
   * Reset tracking arrays
   */
  reset() {
    this.joinedGroups = [];
    this.failedGroups = [];
    logger.info('Group manager reset');
  }
}

export default GroupManager;
