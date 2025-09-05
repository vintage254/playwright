#!/usr/bin/env node

/**
 * Facebook Automation Educational Script
 * Main orchestration for cybersecurity learning and web developer marketing
 * 
 * Usage: node main.js [options]
 * 
 * This script demonstrates:
 * - Automation detection evasion techniques
 * - Session management and persistence
 * - Human-like interaction simulation
 * - Popup and security challenge handling
 */

import { Browser, BrowserContext, Page } from 'playwright';
import { createStealthBrowser } from './config/browser-config';
import SessionManager from './lib/session-manager';
import GroupManager from './lib/group-manager';
import PostManager from './lib/post-manager';
import AlertSystem from './lib/alert-system';
import { GroupDiscovery } from './lib/group-discovery';
import { GroupSelector } from './lib/group-selector';
import { logger, DELAYS, ERROR_HANDLER } from './lib/utils';
import path from 'path';
import fs from 'fs-extra';
import readline from 'readline';

// Simple console colors without chalk
const colors = {
  blue: (text: string) => `\x1b[34m${text}\x1b[0m`,
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
  dim: (text: string) => `\x1b[2m${text}\x1b[0m`,
  bold: {
    blue: (text: string) => `\x1b[1m\x1b[34m${text}\x1b[0m`,
    green: (text: string) => `\x1b[1m\x1b[32m${text}\x1b[0m`,
    cyan: (text: string) => `\x1b[1m\x1b[36m${text}\x1b[0m`
  }
};

interface AutomationConfig {
  headless: boolean;
  slowMo: number;
  sessionFile: string;
  logLevel: string;
  groupUrls?: string[];
  joinGroups?: boolean;
  createPosts?: boolean;
  postTemplate?: any;
  joinOptions?: any;
}

interface AutomationStats {
  groupsJoined: number;
  postsCreated: number;
  errors: number;
  interventions: number;
}

class FacebookAutomation {
  config: AutomationConfig;
  browser: Browser | null;
  context: BrowserContext | null;
  page: Page | null;
  sessionManager: SessionManager | null;
  groupManager: GroupManager | null;
  postManager: PostManager | null;
  alertSystem: AlertSystem | null;
  isRunning: boolean;
  shouldStop: boolean;
  stats: AutomationStats;

  constructor(config: Partial<AutomationConfig> = {}) {
    this.config = {
      headless: false,
      slowMo: 100,
      sessionFile: 'fb-session.json',
      logLevel: 'info',
      ...config
    };
    
    this.browser = null;
    this.context = null;
    this.page = null;
    this.sessionManager = null;
    this.groupManager = null;
    this.postManager = null;
    this.alertSystem = null;
    
    this.isRunning = false;
    this.shouldStop = false;
    this.stats = {
      groupsJoined: 0,
      postsCreated: 0,
      errors: 0,
      interventions: 0
    };
  }

  /**
   * Initialize the automation system
   */
  async initialize() {
    try {
      logger.info(colors.blue('🚀 Initializing Facebook Automation System'));
      
      // Create browser and context
      const browserSetup = await createStealthBrowser({
        slowMo: this.config.slowMo
      });
      
      this.browser = browserSetup.browser;
      this.context = browserSetup.context;
      this.page = await this.context.newPage();
      
      // Initialize managers
      this.sessionManager = new SessionManager(this.config.sessionFile);
      this.groupManager = new GroupManager(this.page);
      this.postManager = new PostManager(this.page);
      this.alertSystem = new AlertSystem(this.page);
      
      // Set up alert system callbacks
      this.alertSystem.addAlertCallback((alertData) => {
        this.stats.interventions++;
        logger.warn(`Manual intervention required: ${alertData.type}`);
      });
      
      // Start monitoring for popups
      await this.alertSystem.startMonitoring();
      
      logger.info(colors.green('✅ System initialized successfully'));
      return true;
    } catch (error) {
      if (error instanceof Error) {
        ERROR_HANDLER.handle(error, 'initialize');
      } else {
        ERROR_HANDLER.handle(new Error(String(error)), 'initialize');
      }
      return false;
    }
  }

  /**
   * Handle login process
   */
  async handleLogin() {
    if (!this.sessionManager || !this.context || !this.page) {
      throw new Error('SessionManager, context, or page not initialized.');
    }
    try {
      logger.info(colors.yellow('🔐 Handling Facebook login...'));
      
      // Try to load existing session
      const sessionLoaded = await this.sessionManager.loadSession(this.context, this.page);
      
      if (sessionLoaded) {
        logger.info(colors.green('✅ Session restored from saved data'));
        return true;
      }
      
      // Manual login required
      logger.info(colors.yellow('⚠️ Manual login required'));
      const loginSuccess = await this.sessionManager.performLogin(this.page);
      
      if (loginSuccess) {
        // Save the new session
        await this.sessionManager.saveSession(this.context, this.page);
        logger.info(colors.green('✅ Login successful and session saved'));
        return true;
      }
      
      logger.error(colors.red('❌ Login failed'));
      return false;
    } catch (error) {
      if (error instanceof Error) {
        ERROR_HANDLER.handle(error, 'handleLogin');
      } else {
        ERROR_HANDLER.handle(new Error(String(error)), 'handleLogin');
      }
      return false;
    }
  }

  /**
   * Join multiple Facebook groups
   * @param {Array} groupUrls - Array of group URLs
   * @param {Object} options - Join options
   */
  async joinGroups(groupUrls: string[], options: any = {}) {
    if (!this.alertSystem || !this.groupManager) {
        throw new Error('AlertSystem or GroupManager not initialized.');
    }
    try {
      logger.info(colors.blue(`🎯 Starting to join ${groupUrls.length} groups`));
      
      for (let i = 0; i < groupUrls.length; i++) {
        if (this.shouldStop) {
          logger.info('Stopping group joining due to user request');
          break;
        }

        const groupUrl = groupUrls[i];
        logger.info(colors.cyan(`📝 Processing group ${i + 1}/${groupUrls.length}: ${groupUrl}`));
        
        // Wait for any manual interventions
        while (this.alertSystem.isWaitingForIntervention()) {
          logger.info('Waiting for manual intervention to complete...');
          await DELAYS.medium();
        }
        
        try {
          const result = await this.groupManager.joinGroup(groupUrl, options);
          
          if (result.success) {
            this.stats.groupsJoined++;
            logger.info(colors.green(`✅ Successfully joined group: ${result.status}`));
          } else {
            this.stats.errors++;
            logger.error(colors.red(`❌ Failed to join group: ${result.message}`));
          }
          
          // Random delay between groups to appear human
          if (i < groupUrls.length - 1) {
            await DELAYS.random(3000, 8000);
          }
          
        } catch (error) {
          if (error instanceof Error) {
            ERROR_HANDLER.handle(error, 'joinGroup', { groupUrl });
          } else {
            ERROR_HANDLER.handle(new Error(String(error)), 'joinGroup', { groupUrl });
          }
          this.stats.errors++;
        }
      }
      
      logger.info(colors.green(`🎉 Group joining completed. Joined: ${this.stats.groupsJoined}`));
    } catch (error) {
      if (error instanceof Error) {
        ERROR_HANDLER.handle(error, 'joinGroups');
      } else {
        ERROR_HANDLER.handle(new Error(String(error)), 'joinGroups');
      }
    }
  }

  /**
   * Create posts in joined groups
   * @param {Array} groupUrls - Array of group URLs
   * @param {Object} postTemplate - Post template
   */
  async createPosts(groupUrls: string[], postTemplate: any) {
    if (!this.alertSystem || !this.postManager) {
        throw new Error('AlertSystem or PostManager not initialized.');
    }
    try {
      logger.info(colors.blue(`📝 Starting to create posts in ${groupUrls.length} groups`));
      
      for (let i = 0; i < groupUrls.length; i++) {
        if (this.shouldStop) {
          logger.info('Stopping post creation due to user request');
          break;
        }

        const groupUrl = groupUrls[i];
        logger.info(colors.cyan(`✍️ Creating post ${i + 1}/${groupUrls.length} in: ${groupUrl}`));
        
        // Wait for any manual interventions
        while (this.alertSystem.isWaitingForIntervention()) {
          logger.info('Waiting for manual intervention to complete...');
          await DELAYS.medium();
        }
        
        try {
          // Prepare post data
          const postData = {
            ...postTemplate,
            groupUrl: groupUrl
          };
          
          const result = await this.postManager.createPost(postData);
          
          if (result.success) {
            this.stats.postsCreated++;
            logger.info(colors.green(`✅ Post created successfully`));
          } else {
            this.stats.errors++;
            logger.error(colors.red(`❌ Failed to create post: ${result.error}`));
          }
          
          // Longer delay between posts to avoid spam detection
          if (i < groupUrls.length - 1) {
            await DELAYS.random(5000, 12000);
          }
          
        } catch (error) {
          if (error instanceof Error) {
            ERROR_HANDLER.handle(error, 'createPost', { groupUrl });
          } else {
            ERROR_HANDLER.handle(new Error(String(error)), 'createPost', { groupUrl });
          }
          this.stats.errors++;
        }
      }
      
      logger.info(colors.green(`🎉 Post creation completed. Created: ${this.stats.postsCreated}`));
    } catch (error) {
      if (error instanceof Error) {
        ERROR_HANDLER.handle(error, 'createPosts');
      } else {
        ERROR_HANDLER.handle(new Error(String(error)), 'createPosts');
      }
    }
  }

  /**
   * Run sequential category processing workflow
   * @param {Object} config - Automation configuration with categories
   */
  async runSequentialCategories(config: any) {
    try {
      this.isRunning = true;
      this.shouldStop = false;
      
      logger.info(colors.bold.blue('🤖 Starting Sequential Category Processing'));
      logger.info(colors.dim('Educational purposes - Cybersecurity learning'));
      
      // Initialize system
      const initialized = await this.initialize();
      if (!initialized) {
        throw new Error('Failed to initialize automation system');
      }
      
      // Handle login
      const loggedIn = await this.handleLogin();
      if (!loggedIn) {
        throw new Error('Failed to login to Facebook');
      }
      
      // Initialize group discovery
      if (!this.page) {
        throw new Error('Page not initialized');
      }
      const groupDiscovery = new GroupDiscovery(this.page);
      
      // Process each category sequentially
      for (let i = 0; i < config.categories.length; i++) {
        if (this.shouldStop) {
          logger.info('Stopping due to user request');
          break;
        }
        
        const category = config.categories[i];
        logger.info(colors.bold.cyan(`\n📂 Processing Category ${i + 1}/${config.categories.length}: ${category.name}`));
        
        try {
          // Step 1: Search for groups in this category
          logger.info(colors.blue(`🔍 Searching for ${category.name}...`));
          const discoveredGroups = await groupDiscovery.getTargetMarketingGroups(category.id);
          
          // Limit to specified number of groups per category
          const groupsToProcess = discoveredGroups.slice(0, config.groupsPerCategory);
          const groupUrls = groupsToProcess.map(group => group.url);
          
          if (groupUrls.length === 0) {
            logger.warn(colors.yellow(`⚠️ No groups found for ${category.name}, skipping...`));
            continue;
          }
          
          logger.info(colors.green(`✅ Found ${groupUrls.length} groups for ${category.name}`));
          
          // Step 2: Join the groups
          if (config.joinGroups) {
            logger.info(colors.blue(`🎯 Joining ${groupUrls.length} groups in ${category.name}...`));
            await this.joinGroups(groupUrls, config.joinOptions || {});
          }
          
          // Step 3: Create posts in the joined groups
          if (config.createPosts) {
            logger.info(colors.blue(`📝 Creating posts in ${category.name} groups...`));
            await this.createPosts(groupUrls, config.postTemplate);
          }
          
          // Delay between categories to avoid spam detection
          if (i < config.categories.length - 1) {
            logger.info(colors.dim('⏳ Waiting before next category...'));
            await DELAYS.random(10000, 20000); // 10-20 seconds between categories
          }
          
        } catch (categoryError) {
          logger.error(colors.red(`❌ Error processing ${category.name}: ${categoryError}`));
          continue; // Continue with next category
        }
      }
      
      // Display final statistics
      this.displayStats();
      
      logger.info(colors.bold.green('🎉 Sequential category processing completed successfully'));
      
    } catch (error) {
      if (error instanceof Error) {
        ERROR_HANDLER.handle(error, 'runSequentialCategories');
      } else {
        ERROR_HANDLER.handle(new Error(String(error)), 'runSequentialCategories');
      }
      logger.error(colors.red('❌ Sequential processing failed'));
    } finally {
      this.isRunning = false;
      await this.cleanup();
    }
  }

  /**
   * Run the complete automation workflow
   * @param {Object} config - Automation configuration
   */
  async run(config: AutomationConfig) {
    // Check if this is sequential mode
    if ((config as any).sequentialMode) {
      return await this.runSequentialCategories(config);
    }
    
    try {
      this.isRunning = true;
      this.shouldStop = false;
      
      logger.info(colors.bold.blue('🤖 Starting Facebook Automation Workflow'));
      logger.info(colors.dim('Educational purposes - Cybersecurity learning'));
      
      // Initialize system
      const initialized = await this.initialize();
      if (!initialized) {
        throw new Error('Failed to initialize automation system');
      }
      
      // Handle login
      const loggedIn = await this.handleLogin();
      if (!loggedIn) {
        throw new Error('Failed to login to Facebook');
      }
      
      // Join groups if requested
      if (config.groupUrls && config.groupUrls.length > 0 && config.joinGroups) {
        await this.joinGroups(config.groupUrls, config.joinOptions || {});
      }
      
      // Create posts if requested
      if (config.groupUrls && config.groupUrls.length > 0 && config.createPosts) {
        await this.createPosts(config.groupUrls, config.postTemplate);
      }
      
      // Display final statistics
      this.displayStats();
      
      logger.info(colors.bold.green('🎉 Automation workflow completed successfully'));
      
    } catch (error) {
      if (error instanceof Error) {
        ERROR_HANDLER.handle(error, 'run');
      } else {
        ERROR_HANDLER.handle(new Error(String(error)), 'run');
      }
      logger.error(colors.red('❌ Automation workflow failed'));
    } finally {
      this.isRunning = false;
      await this.cleanup();
    }
  }

  /**
   * Display automation statistics
   */
  displayStats() {
    console.log('\n' + '='.repeat(50));
    console.log(colors.bold.cyan('📊 AUTOMATION STATISTICS'));
    console.log('='.repeat(50));
    console.log(colors.green(`Groups Joined: ${this.stats.groupsJoined}`));
    console.log(colors.green(`Posts Created: ${this.stats.postsCreated}`));
    console.log(colors.yellow(`Manual Interventions: ${this.stats.interventions}`));
    console.log(colors.red(`Errors: ${this.stats.errors}`));
    console.log('='.repeat(50) + '\n');
  }

  /**
   * Stop the automation
   */
  async stop() {
    logger.info(colors.yellow('🛑 Stopping automation...'));
    this.shouldStop = true;
    
    if (this.alertSystem) {
      this.alertSystem.stopMonitoring();
    }
    
    await this.cleanup();
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    try {
      if (this.alertSystem) {
        this.alertSystem.stopMonitoring();
      }
      
      if (this.browser) {
        await this.browser.close();
      }
      
      logger.info(colors.dim('🧹 Cleanup completed'));
    } catch (error) {
      if (error instanceof Error) {
        ERROR_HANDLER.handle(error, 'cleanup');
      } else {
        ERROR_HANDLER.handle(new Error(String(error)), 'cleanup');
      }
    }
  }
}

/**
 * Simple input helper function
 */
function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(query, answer => {
      rl.close();
      resolve(answer);
    });
  });
}

/**
 * Interactive CLI setup with sequential processing
 */
async function setupInteractiveSession() {
  console.log(colors.bold.blue('\n🎓 Facebook Automation Educational Setup'));
  console.log(colors.dim('For cybersecurity learning and web developer marketing\n'));

  // Ask about automation mode
  console.log('🔍 AUTOMATION MODE:');
  console.log('1. Sequential category processing (recommended)');
  console.log('2. Enter group URLs manually (classic mode)');
  
  const modeChoice = await askQuestion('\nChoose mode (1-2, default: 1): ');
  
  if (modeChoice === '2') {
    // Manual group entry
    const groupUrlsInput = await askQuestion('Enter Facebook group URLs (comma-separated): ');
    const groupUrls = groupUrlsInput.split(',').map(url => url.trim()).filter(url => url.length > 0);
    return await buildConfigFromManualInput(groupUrls);
  } else {
    // Sequential category processing
    console.log('\n🎯 Sequential Category Processing Mode');
    console.log('The automation will process each category one by one:');
    console.log('Search Category → Join 5 Groups → Post in Them → Next Category');
    
    const categories = [
      { id: 'affiliate', name: 'Affiliate marketing groups' },
      { id: 'handmade', name: 'Handmade crafts & DIY groups' },
      { id: 'freelancing', name: 'Freelancing and remote work groups' },
      { id: 'ecommerce', name: 'E-commerce and dropshipping groups' },
      { id: 'marketing', name: 'Digital marketing & SEO groups' },
      { id: 'webdev', name: 'Web development & programming groups' },
      { id: 'lifestyle', name: 'Fashion, beauty, and lifestyle groups' },
      { id: 'business', name: 'High-value business owner groups' }
    ];
    
    return {
      sequentialMode: true,
      categories: categories,
      groupsPerCategory: 5,
      joinGroups: true,
      createPosts: true,
      postTemplate: PostManager.createSampleWebDevPost(),
      joinOptions: {
        skipQuestions: false,
        questionAnswers: {
          0: "I'm a web developer interested in joining this professional community.",
          1: "I specialize in modern web development and would like to connect with peers.",
          2: "I will follow all group rules and contribute positively to discussions."
        }
      }
    };
  }
}
              { id: 'marketing', name: 'Digital marketing & SEO groups' },
              { id: 'webdev', name: 'Web development & programming groups' },
              { id: 'lifestyle', name: 'Fashion, beauty, and lifestyle groups' },
              { id: 'business', name: 'High-value business owner groups' }
            ];
            
            return {
              sequentialMode: true,
              categories: categories,
              groupsPerCategory: 5,
              joinGroups: true,
              createPosts: true,
              postTemplate: PostManager.createSampleWebDevPost(),
              joinOptions: {
                skipQuestions: false,
                questionAnswers: {
                  0: "I'm a web developer interested in joining this professional community.",
                  1: "I specialize in modern web development and would like to connect with peers.",
                  2: "I will follow all group rules and contribute positively to discussions."
                }
              }
            };
          }
        } else {
          console.log(colors.red('❌ Login failed. Falling back to manual entry.'));
          await browser.close();
          const groupUrlsInput = await askQuestion('Enter Facebook group URLs (comma-separated): ');
          groupUrls = groupUrlsInput.split(',').map(url => url.trim()).filter(url => url.length > 0);
          return await buildConfigFromManualInput(groupUrls);
        }
      }
      
      // Initialize group discovery
      const groupDiscovery = new GroupDiscovery(page);
      const groupSelector = new GroupSelector();
      
      // Get joined groups
      console.log(colors.blue('\n📋 Discovering your joined groups...'));
      const joinedGroups = await groupDiscovery.getJoinedGroups();
      
      // Ask user which category to target
      console.log(colors.blue('\n🎯 Which market niches would you like to target?'));
      console.log('1. All categories (maximum reach)');
      console.log('2. Affiliate marketing groups');
      console.log('3. Handmade crafts & DIY groups');
      console.log('4. Freelancing and remote work groups');
      console.log('5. E-commerce and dropshipping groups');
      console.log('6. Digital marketing & SEO groups');
      console.log('7. Web development & programming groups');
      console.log('8. Fashion, beauty, and lifestyle groups');
      console.log('9. High-value business owner groups');
      
      const categoryChoice = await askQuestion('\nSelect category (1-9, default: 1): ');
      
      let discoveredGroups = [];
      console.log(colors.blue('\n🔍 Searching for relevant marketing groups...'));
      
      switch (categoryChoice) {
        case '2':
          discoveredGroups = await groupDiscovery.getTargetMarketingGroups('affiliate');
          break;
        case '3':
          discoveredGroups = await groupDiscovery.getTargetMarketingGroups('handmade');
          break;
        case '4':
          discoveredGroups = await groupDiscovery.getTargetMarketingGroups('freelancing');
          break;
        case '5':
          discoveredGroups = await groupDiscovery.getTargetMarketingGroups('ecommerce');
          break;
        case '6':
          discoveredGroups = await groupDiscovery.getTargetMarketingGroups('marketing');
          break;
        case '7':
          discoveredGroups = await groupDiscovery.getTargetMarketingGroups('webdev');
          break;
        case '8':
          discoveredGroups = await groupDiscovery.getTargetMarketingGroups('lifestyle');
          break;
        case '9':
          discoveredGroups = await groupDiscovery.getTargetMarketingGroups('business');
          break;
        default:
          discoveredGroups = await groupDiscovery.getTargetMarketingGroups('all');
      }
      
      // Close browser after discovery
      await browser.close();
      
      // Let user select groups
      groupUrls = await groupSelector.selectGroups(joinedGroups, discoveredGroups);
      groupSelector.close();
      
      if (groupUrls.length === 0) {
        console.log(colors.yellow('⚠️ No groups selected. Using fallback groups or manual entry.'));
        
        // Fallback groups for common niches
        const fallbackGroups = [
          'https://www.facebook.com/groups/affiliatemarketingmastery',
          'https://www.facebook.com/groups/digitalmarketingexperts',
          'https://www.facebook.com/groups/webdevelopersunited',
          'https://www.facebook.com/groups/freelancersnetwork',
          'https://www.facebook.com/groups/ecommercebusiness'
        ];
        
        console.log('\n📋 Suggested fallback groups:');
        fallbackGroups.forEach((url, index) => {
          console.log(`${index + 1}. ${url}`);
        });
        
        const useDefaults = await askQuestion('\nUse suggested groups? (y/n, default: y): ');
        if (useDefaults.toLowerCase() !== 'n') {
          groupUrls = fallbackGroups;
          console.log(colors.green(`✅ Using ${fallbackGroups.length} fallback groups`));
        } else {
          const groupUrlsInput = await askQuestion('Enter Facebook group URLs (comma-separated): ');
          groupUrls = groupUrlsInput.split(',').map(url => url.trim()).filter(url => url.length > 0);
        }
      }
      
    } catch (error) {
        if (error instanceof Error) {
            logger.error(`Group discovery failed: ${error.message}`);
        } else {
            logger.error(`An unknown error occurred during group discovery: ${error}`);
        }
      console.log(colors.red('❌ Group discovery failed. Falling back to manual entry.'));
      const groupUrlsInput = await askQuestion('Enter Facebook group URLs (comma-separated): ');
      groupUrls = groupUrlsInput.split(',').map(url => url.trim()).filter(url => url.length > 0);
    }
  }
  
  return await buildConfigFromManualInput(groupUrls);
}

/**
 * Build configuration from manual input
 * @param {Array} groupUrls - Selected group URLs
 */
async function buildConfigFromManualInput(groupUrls: string[]) {
  const joinGroupsInput = await askQuestion('Join the specified groups? (y/n, default: y): ');
  const joinGroups = joinGroupsInput.toLowerCase() !== 'n';
  
  const createPostsInput = await askQuestion('Create marketing posts in groups? (y/n, default: y): ');
  const createPosts = createPostsInput.toLowerCase() !== 'n';
  
  const customMessage = await askQuestion('Custom post message (leave empty for default web dev marketing): ');
  
  const imagePathsInput = await askQuestion('Image paths for posts (comma-separated, optional): ');
  const imagePaths: string[] = imagePathsInput.split(',').map(path => path.trim()).filter(path => path.length > 0);

  // Prepare post template
  let postTemplate: { message: string; imagePaths: string[]; waitForConfirmation?: boolean; };
  if (customMessage) {
    postTemplate = {
      message: customMessage,
      imagePaths: imagePaths
    };
  } else {
    postTemplate = PostManager.createSampleWebDevPost();
    postTemplate.imagePaths = imagePaths;
  }

  return {
    groupUrls: groupUrls,
    joinGroups: joinGroups,
    createPosts: createPosts,
    postTemplate,
    joinOptions: {
      skipQuestions: false,
      questionAnswers: {
        0: "I'm a web developer interested in joining this professional community.",
        1: "I specialize in modern web development and would like to connect with peers.",
        2: "I will follow all group rules and contribute positively to discussions."
      }
    }
  };
}

/**
 * Main execution
 */
async function main() {
  try {
    // Handle process signals
    process.on('SIGINT', async () => {
      console.log('\n' + colors.yellow('🛑 Received interrupt signal'));
      process.exit(0);
    });

    // Create automation instance
    const automation = new FacebookAutomation();
    
    // Get configuration from interactive setup
    const runConfig = await setupInteractiveSession();

    const config: AutomationConfig = {
        ...automation.config,
        ...runConfig
    };
    
    if (!config.groupUrls || config.groupUrls.length === 0) {
      console.log(colors.yellow('⚠️ No group URLs provided. Exiting.'));
      return;
    }
    
    console.log(colors.green('\n🚀 Starting automation with provided configuration...\n'));
    
    // Run the automation
    await automation.run(config);
    
  } catch (error) {
    if (error instanceof Error) {
      ERROR_HANDLER.handle(error, 'main');
    } else {
      ERROR_HANDLER.handle(new Error(String(error)), 'main');
    }
    console.error(colors.red('❌ Fatal error occurred'));
    process.exit(1);
  }
}

// Export for programmatic use
export default FacebookAutomation;

// Run if called directly
main();
