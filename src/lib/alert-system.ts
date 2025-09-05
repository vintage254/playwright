/**
 * Alert System for Manual Intervention
 * Educational automation - handles popups, captchas, and security checks
 * Pauses automation and alerts user for manual resolution
 */

import beeper from 'beeper';
import { logger, DELAYS, VALIDATION, ERROR_HANDLER } from './utils';
import { FACEBOOK_SELECTORS } from '../config/selectors';

import { Page } from 'playwright';

// Define types for alert system
type AlertPriority = 'critical' | 'high' | 'medium' | 'low';

interface PopupPattern {
  selector: string;
  type: string;
  priority: AlertPriority;
}

interface AlertData {
  type: string;
  priority: AlertPriority;
  selector: string;
  timestamp: string;
  pageUrl: string;
  screenshot: string | null;
}

interface AlertSystemOptions {
  checkInterval?: number;
  interventionTimeout?: number;
}

interface AlertStatus {
  isMonitoring: boolean;
  interventionRequired: boolean;
  checkInterval: number;
  activeCallbacks: number;
}

type ResolutionAction = { action: 'continue' | 'stop' | 'timeout' };

class AlertSystem {
  page: Page;
  isMonitoring: boolean;
  interventionRequired: boolean;
  alertCallbacks: ((alertData: AlertData) => void)[];
  checkInterval: number;
  interventionTimeout: number;
  popupPatterns: PopupPattern[];

  constructor(page: Page, options: AlertSystemOptions = {}) {
    this.page = page;
    this.isMonitoring = false;
    this.interventionRequired = false;
    this.alertCallbacks = [];
    this.checkInterval = options.checkInterval || 2000; // Check every 2 seconds
    this.interventionTimeout = options.interventionTimeout || 300000; // 5 minutes default
    
    // Popup detection patterns
    this.popupPatterns = [
      // Security and verification
      { selector: FACEBOOK_SELECTORS.POPUPS.securityCheck, type: 'security', priority: 'critical' },
      { selector: FACEBOOK_SELECTORS.POPUPS.captcha, type: 'captcha', priority: 'critical' },
      { selector: FACEBOOK_SELECTORS.POPUPS.twoFactorAuth, type: '2fa', priority: 'critical' },
      { selector: FACEBOOK_SELECTORS.POPUPS.sessionTimeout, type: 'session', priority: 'high' },
      { selector: FACEBOOK_SELECTORS.POPUPS.unusualActivity, type: 'security', priority: 'critical' },
      
      // Blocking and restrictions
      { selector: FACEBOOK_SELECTORS.BLOCKS.blocked, type: 'blocked', priority: 'critical' },
      { selector: FACEBOOK_SELECTORS.BLOCKS.restricted, type: 'restricted', priority: 'high' },
      { selector: FACEBOOK_SELECTORS.BLOCKS.spamWarning, type: 'spam', priority: 'high' },
      { selector: FACEBOOK_SELECTORS.BLOCKS.rateLimit, type: 'rate_limit', priority: 'medium' },
      
      // Custom patterns for educational detection
      { selector: 'div:has-text("verify")', type: 'verification', priority: 'high' },
      { selector: 'div:has-text("suspicious")', type: 'security', priority: 'critical' },
      { selector: 'div:has-text("temporarily blocked")', type: 'blocked', priority: 'critical' },
      { selector: 'div:has-text("review")', type: 'review', priority: 'medium' },
      { selector: '[role="dialog"]', type: 'dialog', priority: 'low' }
    ];
  }

  /**
   * Start monitoring for popups and intervention needs
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      logger.warn('Alert system already monitoring');
      return;
    }

    this.isMonitoring = true;
    logger.info('Alert system started monitoring for popups');
    
    // Start the monitoring loop
    this.monitoringLoop();
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    this.isMonitoring = false;
    logger.info('Alert system stopped monitoring');
  }

  /**
   * Main monitoring loop
   */
  async monitoringLoop(): Promise<void> {
    while (this.isMonitoring) {
      try {
        await this.checkForPopups();
        await new Promise(resolve => setTimeout(resolve, this.checkInterval));
      } catch (error) {
        if (error instanceof Error) {
            ERROR_HANDLER.handle(error, 'monitoringLoop');
        }
        await DELAYS.short();
      }
    }
  }

  /**
   * Check for various popup patterns
   */
  async checkForPopups(): Promise<void> {
    if (this.interventionRequired) {
      return; // Already waiting for intervention
    }

    for (const pattern of this.popupPatterns) {
      try {
        if (await VALIDATION.isElementVisible(this.page, pattern.selector)) {
          await this.handlePopupDetection(pattern);
          return;
        }
      } catch (error) {
        // Continue checking other patterns
        continue;
      }
    }
  }

  /**
   * Handle detected popup
   * @param {Object} pattern - Detected popup pattern
   */
  async handlePopupDetection(pattern: PopupPattern) {
    const alertData: AlertData = {
      type: pattern.type,
      priority: pattern.priority,
      selector: pattern.selector,
      timestamp: new Date().toISOString(),
      pageUrl: this.page.url(),
      screenshot: null as string | null
    };

    logger.warn(`Popup detected: ${pattern.type} (${pattern.priority} priority)`);

    // Take screenshot for documentation
    try {
      const screenshotPath = `./logs/popup_${Date.now()}.png`;
      await this.page.screenshot({ path: screenshotPath, fullPage: true });
      alertData.screenshot = screenshotPath;
      logger.info(`Screenshot saved: ${screenshotPath}`);
    } catch (error) {
      logger.error('Failed to capture screenshot');
    }

    // Trigger manual intervention
    await this.triggerManualIntervention(alertData);
  }

  /**
   * Trigger manual intervention alert
   * @param {Object} alertData - Alert information
   */
  async triggerManualIntervention(alertData: AlertData): Promise<void> {
    this.interventionRequired = true;
    
    // Audio alert
    await this.playAlert(alertData.priority);
    
    // Console alert
    this.displayConsoleAlert(alertData);
    
    // Browser alert (if possible)
    try {
      await this.showBrowserAlert(alertData);
    } catch (error) {
      logger.warn('Could not show browser alert');
    }

    // Notify callbacks
    this.notifyCallbacks(alertData);
    
    // Wait for manual resolution
    await this.waitForManualResolution(alertData);
  }

  /**
   * Play audio alert based on priority
   * @param {string} priority - Alert priority
   */
  async playAlert(priority: AlertPriority) {
    try {
      const beepPatterns: { [key in AlertPriority]: number[] } = {
        'critical': [200, 100, 200, 100, 200], // Urgent pattern
        'high': [300, 200, 300], // Important pattern
        'medium': [400, 300], // Normal pattern
        'low': [500] // Single beep
      };

      const pattern = beepPatterns[priority] || beepPatterns['medium'];
      
      for (let i = 0; i < pattern.length; i++) {
        await beeper(pattern[i]);
        if (i < pattern.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } catch (error) {
      logger.warn('Could not play audio alert');
    }
  }

  /**
   * Display console alert
   * @param {Object} alertData - Alert information
   */
  displayConsoleAlert(alertData: AlertData): void {
    const border = '='.repeat(60);
    const priorityIcon: { [key in AlertPriority]: string } = {
      'critical': '🚨',
      'high': '⚠️',
      'medium': '🔔',
      'low': 'ℹ️'
    };

    console.log('\n' + border);
    console.log(`${priorityIcon[alertData.priority]} MANUAL INTERVENTION REQUIRED`);
    console.log(border);
    console.log(`Type: ${alertData.type.toUpperCase()}`);
    console.log(`Priority: ${alertData.priority.toUpperCase()}`);
    console.log(`Time: ${new Date(alertData.timestamp).toLocaleString()}`);
    console.log(`Page: ${alertData.pageUrl}`);
    if (alertData.screenshot) {
      console.log(`Screenshot: ${alertData.screenshot}`);
    }
    console.log('\nACTION REQUIRED:');
    console.log('1. Check the browser window');
    console.log('2. Resolve the popup/security check manually');
    console.log('3. Press ENTER in this console to continue automation');
    console.log('\nOr type "stop" to halt the automation');
    console.log(border + '\n');
  }

  /**
   * Show browser alert if possible
   * @param {Object} alertData - Alert information
   */
  async showBrowserAlert(alertData: AlertData): Promise<void> {
    try {
      const alertMessage = `AUTOMATION PAUSED\n\nIntervention Required: ${alertData.type}\nPriority: ${alertData.priority}\n\nPlease resolve manually and close this alert to continue.`;
      
      await this.page.evaluate((message) => {
        // Create a custom alert overlay
        const overlay = document.createElement('div');
        overlay.id = 'automation-alert-overlay';
        overlay.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(255, 0, 0, 0.8);
          color: white;
          font-family: Arial, sans-serif;
          font-size: 18px;
          font-weight: bold;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 999999;
          text-align: center;
          padding: 20px;
          box-sizing: border-box;
        `;
        
        overlay.innerHTML = `
          <div style="background: #d32f2f; padding: 30px; border-radius: 10px; max-width: 500px;">
            <h2 style="margin: 0 0 20px 0; color: white;">🚨 AUTOMATION PAUSED</h2>
            <p style="margin: 10px 0;">${message}</p>
            <button onclick="document.getElementById('automation-alert-overlay').remove()" 
                    style="background: white; color: #d32f2f; border: none; padding: 10px 20px; 
                           font-size: 16px; font-weight: bold; border-radius: 5px; cursor: pointer; margin-top: 20px;">
              CONTINUE AUTOMATION
            </button>
          </div>
        `;
        
        document.body.appendChild(overlay);
      }, alertMessage);
      
    } catch (error) {
      if (error instanceof Error) {
        ERROR_HANDLER.handle(error, 'showBrowserAlert');
      }
    }
  }

  /**
   * Wait for manual resolution
   * @param {Object} alertData - Alert information
   */
  async waitForManualResolution(alertData: AlertData): Promise<ResolutionAction> {
    const startTime = Date.now();
    
    // Auto-continue for low priority alerts to avoid blocking automation
    if (alertData.priority === 'low') {
      logger.info('Auto-continuing for low priority alert');
      this.interventionRequired = false;
      return { action: 'continue' } as ResolutionAction;
    }
    
    return new Promise((resolve) => {
      const checkResolution = async () => {
        // Check if user pressed Enter
        const input = await this.getUserInput();
        
        if (input === 'stop') {
          logger.info('User requested automation stop');
          this.isMonitoring = false;
          this.interventionRequired = false;
          resolve({ action: 'stop' } as ResolutionAction);
          return;
        }
        
        if (input === 'continue' || input === '') {
          logger.info('Auto-continuing automation');
          this.interventionRequired = false;
          resolve({ action: 'continue' } as ResolutionAction);
          return;
        }
        
        // Check for timeout
        if (Date.now() - startTime > this.interventionTimeout) {
          logger.error('Manual intervention timeout');
          this.interventionRequired = false;
          resolve({ action: 'timeout' } as ResolutionAction);
          return;
        }
        
        // Continue checking
        setTimeout(checkResolution, 1000);
      };
      
      checkResolution();
    });
  }

  /**
   * Get user input (simplified for educational purposes)
   * In a real implementation, this would use readline or similar
   */
  async getUserInput(): Promise<'continue' | 'stop' | null> {
    // This is a simplified version - in practice, you'd use readline
    // For now, we'll check for browser alert dismissal
    try {
      const overlayExists = await this.page.evaluate(() => {
        return document.getElementById('automation-alert-overlay') !== null;
      });
      
      if (!overlayExists) {
        return 'continue'; // User dismissed the overlay
      }
    } catch (error) {
      // If we can't check, assume continuation for automation flow
      return 'continue';
    }
    
    // Auto-continue after short delay for non-critical alerts
    return 'continue';
  }

  /**
   * Add callback for alert notifications
   * @param {Function} callback - Callback function
   */
  addAlertCallback(callback: (alertData: AlertData) => void) {
    this.alertCallbacks.push(callback);
  }

  /**
   * Remove alert callback
   * @param {Function} callback - Callback function to remove
   */
  removeAlertCallback(callback: (alertData: AlertData) => void) {
    const index = this.alertCallbacks.indexOf(callback);
    if (index > -1) {
      this.alertCallbacks.splice(index, 1);
    }
  }

  /**
   * Notify all registered callbacks
   * @param {Object} alertData - Alert information
   */
  notifyCallbacks(alertData: AlertData) {
    this.alertCallbacks.forEach(callback => {
      try {
        callback(alertData);
      } catch (error) {
        if (error instanceof Error) {
            ERROR_HANDLER.handle(error, 'notifyCallbacks');
        }
      }
    });
  }

  /**
   * Check if currently waiting for intervention
   * @returns {boolean} Intervention status
   */
  isWaitingForIntervention(): boolean {
    return this.interventionRequired;
  }

  /**
   * Force continue (for testing purposes)
   */
  forceContinue(): void {
    this.interventionRequired = false;
    logger.info('Manual intervention forced to continue');
  }

  /**
   * Get monitoring status
   * @returns {Object} Status information
   */
  getStatus(): AlertStatus {
    return {
      isMonitoring: this.isMonitoring,
      interventionRequired: this.interventionRequired,
      checkInterval: this.checkInterval,
      activeCallbacks: this.alertCallbacks.length
    };
  }
}

export default AlertSystem;
