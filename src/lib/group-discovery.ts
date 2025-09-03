/**
 * Facebook Group Discovery System
 * Automatically finds user's joined groups and discovers new relevant groups
 */

import { Page } from 'playwright';
import { logger, DELAYS, SCROLL, VALIDATION, ERROR_HANDLER } from './utils';
import { FACEBOOK_SELECTORS } from '../config/selectors';
import type { GroupInfo, CategoryType } from '../types/automation';

const SELECTORS = FACEBOOK_SELECTORS;

export class GroupDiscovery {
  private page: Page;
  private joinedGroups: GroupInfo[] = [];
  private discoveredGroups: GroupInfo[] = [];

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Get all groups the user has already joined
   * @returns {Promise<GroupInfo[]>} Array of joined group objects
   */
  async getJoinedGroups(): Promise<GroupInfo[]> {
    try {
      logger.info('🔍 Discovering your joined Facebook groups...');
      await this.page.goto('https://www.facebook.com/groups/feed', { waitUntil: 'networkidle' });
      await DELAYS.medium();

      if (this.page.url().includes('login') || !this.page.url().includes('groups')) {
        await this.page.goto('https://www.facebook.com/groups', { waitUntil: 'networkidle' });
        await DELAYS.medium();
      }

      await this.scrollToLoadGroups();
      const groups = await this.extractGroupsFromPage();
      this.joinedGroups = groups;
      logger.info(`✅ Found ${groups.length} joined groups`);
      return groups;
    } catch (error) {
      if (error instanceof Error) {
        ERROR_HANDLER.handle(error, 'getJoinedGroups');
      } else {
        ERROR_HANDLER.handle(new Error(String(error)), 'getJoinedGroups');
      }
      return [];
    }
  }

  /**
   * Search for new groups based on keywords
   * @param {string[]} keywords - Search keywords
   * @returns {Promise<GroupInfo[]>} Array of discovered group objects
   */
  async searchGroups(keywords: string[]): Promise<GroupInfo[]> {
    try {
      logger.info(`🔍 Searching for groups with keywords: ${keywords.join(', ')}`);
      const allGroups: GroupInfo[] = [];

      for (const keyword of keywords) {
        logger.info(`Searching for: ${keyword}`);
        await this.page.goto(`https://www.facebook.com/search/groups/?q=${encodeURIComponent(keyword)}`, { waitUntil: 'networkidle' });
        await DELAYS.long();
        await this.scrollToLoadGroups(3);

        const searchGroups = await this.extractGroupsFromSearchPage();
        const keywordGroups = searchGroups.map(group => ({
          ...group,
          searchKeyword: keyword,
          relevanceScore: this.calculateRelevanceScore(group, keyword)
        }));

        allGroups.push(...keywordGroups);
        await DELAYS.random(2000, 4000);
      }

      const uniqueGroups = this.removeDuplicateGroups(allGroups);
      const sortedGroups = uniqueGroups.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));

      this.discoveredGroups = sortedGroups;
      logger.info(`✅ Discovered ${sortedGroups.length} relevant groups`);
      return sortedGroups;
    } catch (error) {
      if (error instanceof Error) {
        ERROR_HANDLER.handle(error, 'searchGroups');
      } else {
        ERROR_HANDLER.handle(new Error(String(error)), 'searchGroups');
      }
      return [];
    }
  }

  /**
   * Get suggested groups for web developers targeting broader marketing niches
   * @param {CategoryType} category - Category of groups to search for
   * @returns {Promise<GroupInfo[]>} Array of suggested groups
   */
  async getTargetMarketingGroups(category: CategoryType = 'all'): Promise<GroupInfo[]> {
    const keywordCategories = {
      'affiliate': [
        'affiliate marketing',
        'affiliate marketers',
        'affiliate programs',
        'performance marketing',
        'online income',
        'passive income',
      ],
      'handmade': [
        'handmade crafts',
        'DIY projects',
        'handmade business',
        'craft entrepreneurs',
        'etsy sellers',
      ],
      'freelancing': [
        'freelancing',
        'remote work',
        'digital nomads',
        'freelance jobs',
        'work from home',
      ],
      'ecommerce': [
        'ecommerce',
        'dropshipping',
        'online store',
        'shopify',
        'amazon sellers',
      ],
      'marketing': [
        'digital marketing',
        'SEO',
        'social media marketing',
        'content marketing',
        'online advertising',
      ],
      'webdev': [
        'web development',
        'web developers',
        'javascript developers',
        'react developers',
        'frontend developers',
      ],
      'lifestyle': [
        'fashion business',
        'beauty entrepreneurs',
        'lifestyle bloggers',
        'influencer marketing',
      ],
      'business': [
        'small business owners',
        'entrepreneurs',
        'startup founders',
        'business networking',
        'online business',
      ]
    };

    let keywords: string[] = [];
    if (category === 'all') {
      keywords = Object.values(keywordCategories).flat();
    } else if (category in keywordCategories) {
      keywords = keywordCategories[category];
    }

    return this.searchGroups(keywords);
  }

  /**
   * Scroll page to load more groups
   * @param {number} scrollCount - Number of scroll cycles
   */
  async scrollToLoadGroups(scrollCount = 5): Promise<void> {
    try {
      for (let i = 0; i < scrollCount; i++) {
        await SCROLL.natural(this.page, 800);
        await DELAYS.random(1000, 2000);
      }
    } catch (error) {
      if (error instanceof Error) {
        ERROR_HANDLER.handle(error, 'scrollToLoadGroups');
      } else {
        ERROR_HANDLER.handle(new Error(String(error)), 'scrollToLoadGroups');
      }
    }
  }

  /**
   * Extract group information from the user's joined groups page
   * @returns {Promise<GroupInfo[]>} Array of group objects
   */
  async extractGroupsFromPage(): Promise<GroupInfo[]> {
    try {
      const groupElements = await this.page.$$(SELECTORS.GROUPS.JOINED_GROUP_ITEM);
      const groups: GroupInfo[] = [];

      for (const element of groupElements) {
        try {
          const nameElement = await element.$(SELECTORS.GROUPS.JOINED_GROUP_NAME);
          const groupName = await nameElement?.textContent() || 'Unknown';
          const groupUrl = await nameElement?.getAttribute('href') || '';

          groups.push({
            url: `https://www.facebook.com${groupUrl}`,
            name: groupName.trim(),
            memberCount: 0, // Member count is not easily available on this page
            isJoined: true,
            relevanceScore: 0
          });
        } catch (e) { continue; }
      }
      return groups;
    } catch (error) {
      if (error instanceof Error) {
        ERROR_HANDLER.handle(error, 'extractGroupsFromPage');
      } else {
        ERROR_HANDLER.handle(new Error(String(error)), 'extractGroupsFromPage');
      }
      return [];
    }
  }

  /**
   * Extract group information from a search results page
   * @returns {Promise<GroupInfo[]>} Array of group objects
   */
  async extractGroupsFromSearchPage(): Promise<GroupInfo[]> {
    try {
      const groupElements = await this.page.$$(SELECTORS.GROUPS.SEARCH_RESULT_ITEM);
      const groups: GroupInfo[] = [];

      for (const element of groupElements) {
        try {
          const nameElement = await element.$(SELECTORS.GROUPS.SEARCH_GROUP_NAME);
          const groupName = await nameElement?.textContent() || 'Unknown';
          const groupUrl = await nameElement?.getAttribute('href') || '';

          const memberCountElement = await element.$(SELECTORS.GROUPS.SEARCH_MEMBER_COUNT);
          const memberCountText = await memberCountElement?.textContent() || '0 members';
          const memberCount = this.parseMemberCount(memberCountText);

          groups.push({
            url: groupUrl,
            name: groupName.trim(),
            memberCount: memberCount,
            isJoined: false,
            relevanceScore: 0
          });
        } catch (e) { continue; }
      }
      return groups;
    } catch (error) {
      if (error instanceof Error) {
        ERROR_HANDLER.handle(error, 'extractGroupsFromSearchPage');
      } else {
        ERROR_HANDLER.handle(new Error(String(error)), 'extractGroupsFromSearchPage');
      }
      return [];
    }
  }

  /**
   * Parse member count from text (e.g., '1.2K members')
   * @param {string} text - Text containing member information
   * @returns {number} Member count
   */
  private parseMemberCount(text: string): number {
    if (!text) return 0;
    const textLower = text.toLowerCase();
    let multiplier = 1;
    if (textLower.includes('k')) multiplier = 1000;
    if (textLower.includes('m')) multiplier = 1000000;

    const num = parseFloat(text.replace(/[^0-9.]/g, ''));
    return isNaN(num) ? 0 : Math.floor(num * multiplier);
  }

  /**
   * Calculate relevance score for a group based on keyword
   * @param {GroupInfo} group - Group object
   * @param {string} keyword - Search keyword
   * @returns {number} Relevance score (0-100)
   */
  calculateRelevanceScore(group: GroupInfo, keyword: string): number {
    let score = 0;
    const name = group.name.toLowerCase();
    const kw = keyword.toLowerCase();

    if (name.includes(kw)) score += 50;
    kw.split(' ').forEach(word => {
      if (name.includes(word)) score += 10;
    });

    if (group.memberCount > 50000) score += 20;
    else if (group.memberCount > 10000) score += 10;

    return Math.min(score, 100);
  }

  /**
   * Remove duplicate groups from an array based on URL
   * @param {GroupInfo[]} groups - Array of group objects
   * @returns {GroupInfo[]} Unique groups
   */
  removeDuplicateGroups(groups: GroupInfo[]): GroupInfo[] {
    const seen = new Set<string>();
    return groups.filter(group => {
      const url = group.url;
      if (seen.has(url)) {
        return false;
      } else {
        seen.add(url);
        return true;
      }
    });
  }
}
