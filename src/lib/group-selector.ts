/**
 * Interactive Group Selection Interface
 * Allows users to choose from discovered groups
 */

import readline from 'readline';
import { logger } from './utils';
import type { GroupInfo } from '../types/automation';

export class GroupSelector {
  private rl: readline.Interface;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  /**
   * Ask a question and wait for user input
   * @param {string} question - Question to ask
   * @returns {Promise<string>} User's answer
   */
  askQuestion(question: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer.trim());
      });
    });
  }

  /**
   * Present groups to user and get their selection
   * @param {Array} joinedGroups - User's joined groups
   * @param {Array} discoveredGroups - New discovered groups
   * @returns {Promise<Array>} Selected group URLs
   */
  async selectGroups(joinedGroups: GroupInfo[] = [], discoveredGroups: GroupInfo[] = []): Promise<string[]> {
    try {
      console.log('\n🎯 GROUP DISCOVERY COMPLETE!\n');

      // Show summary
      console.log(`📊 Summary:`);
      console.log(`   ✅ Joined Groups: ${joinedGroups.length}`);
      console.log(`   ➕ New Groups Found: ${discoveredGroups.length}`);
      console.log(`   📋 Total Available: ${joinedGroups.length + discoveredGroups.length}\n`);

      if (joinedGroups.length === 0 && discoveredGroups.length === 0) {
        console.log('❌ No groups found. You can still enter groups manually.');
        return await this.getManualGroupInput();
      }

      // Show selection options
      console.log('🔧 Selection Options:');
      console.log('1. Use your joined groups only');
      console.log('2. Use discovered new groups only');  
      console.log('3. Choose specific groups from all available');
      console.log('4. Use all groups (joined + discovered)');
      console.log('5. Enter groups manually');

      const choice = await this.askQuestion('\nSelect option (1-5): ');

      switch (choice) {
        case '1':
          return this.extractUrls(joinedGroups);
        
        case '2':
          return this.extractUrls(discoveredGroups);
        
        case '3':
          return await this.interactiveSelection([...joinedGroups, ...discoveredGroups]);
        
        case '4':
          return this.extractUrls([...joinedGroups, ...discoveredGroups]);
        
        case '5':
          return await this.getManualGroupInput();
        
        default:
          console.log('❌ Invalid choice. Using all groups by default.');
          return this.extractUrls([...joinedGroups, ...discoveredGroups]);
      }

    } catch (error) {
      if (error instanceof Error) {
        logger.error(`Error in group selection: ${error.message}`);
      } else {
        logger.error(`An unknown error occurred during group selection: ${error}`);
      }
      return await this.getManualGroupInput();
    }
  }

  /**
   * Interactive selection from list of groups
   * @param {Array} groups - All available groups
   * @returns {Promise<Array>} Selected group URLs
   */
  async interactiveSelection(groups: GroupInfo[]): Promise<string[]> {
    try {
      if (groups.length === 0) {
        console.log('❌ No groups available for selection.');
        return [];
      }

      console.log('\n📋 Available Groups:');
      
      // Display all groups with numbers
      groups.forEach((group, index) => {
        const status = group.isJoined ? '✅' : '➕';
        const members = group.memberCount > 0 ? ` (${group.memberCount.toLocaleString()} members)` : '';
        const relevance = group.relevanceScore ? ` [Score: ${group.relevanceScore}]` : '';
        
        console.log(`${index + 1}. ${status} ${group.name}${members}${relevance}`);
      });

      console.log('\n🎯 Selection Instructions:');
      console.log('• Enter numbers separated by commas (e.g., 1,3,5)');
      console.log('• Enter ranges with dashes (e.g., 1-5)'); 
      console.log('• Enter "all" to select all groups');
      console.log('• Enter "none" to skip group selection');

      const input = await this.askQuestion('\nEnter your selection: ');

      if (input.toLowerCase() === 'all') {
        return this.extractUrls(groups);
      }

      if (input.toLowerCase() === 'none') {
        return [];
      }

      // Parse selection input
      const selectedIndices = this.parseSelection(input, groups.length);
      const selectedGroups = selectedIndices.map(index => groups[index - 1]).filter(Boolean);
      
      console.log(`\n✅ Selected ${selectedGroups.length} groups:`);
      selectedGroups.forEach(group => {
        console.log(`   • ${group.name}`);
      });

      return this.extractUrls(selectedGroups);

    } catch (error) {
      if (error instanceof Error) {
        logger.error(`Error in interactive selection: ${error.message}`);
      } else {
        logger.error(`An unknown error occurred during interactive selection: ${error}`);
      }
      return [];
    }
  }

  /**
   * Parse user selection input (numbers, ranges, etc.)
   * @param {string} input - User input
   * @param {number} maxIndex - Maximum valid index
   * @returns {Array<number>} Array of selected indices
   */
  parseSelection(input: string, maxIndex: number): number[] {
    const indices = new Set<number>();
    
    try {
      const parts = input.split(',').map(part => part.trim());
      
      for (const part of parts) {
        if (part.includes('-')) {
          // Handle ranges like "1-5"
          const [start, end] = part.split('-').map(num => parseInt(num.trim()));
          if (start && end && start <= end && start >= 1 && end <= maxIndex) {
            for (let i = start; i <= end; i++) {
              indices.add(i);
            }
          }
        } else {
          // Handle single numbers
          const num = parseInt(part);
          if (num && num >= 1 && num <= maxIndex) {
            indices.add(num);
          }
        }
      }
    } catch (error) {
        if (error instanceof Error) {
            logger.error(`Error parsing selection: ${error.message}`);
        } else {
            logger.error(`An unknown error occurred during selection parsing: ${error}`);
        }
    }

    return Array.from(indices).sort((a: number, b: number) => a - b);
  }

  /**
   * Get manual group input from user
   * @returns {Promise<Array>} Array of group URLs
   */
  async getManualGroupInput(): Promise<string[]> {
    try {
      console.log('\n📝 Manual Group Entry:');
      console.log('Enter Facebook group URLs separated by commas');
      console.log('Example: https://www.facebook.com/groups/123, https://www.facebook.com/groups/456');
      
      const input = await this.askQuestion('\nGroup URLs: ');
      
      if (!input) {
        return [];
      }

      const urls = input.split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0 && url.includes('facebook.com/groups/'));

      console.log(`\n✅ Added ${urls.length} groups manually`);
      return urls;

    } catch (error) {
      if (error instanceof Error) {
        logger.error(`Error in manual group input: ${error.message}`);
      } else {
        logger.error(`An unknown error occurred during manual group input: ${error}`);
      }
      return [];
    }
  }

  /**
   * Extract URLs from group objects
   * @param {Array} groups - Group objects
   * @returns {Array<string>} Array of URLs
   */
  extractUrls(groups: GroupInfo[]): string[] {
    return groups
      .map(group => group.url)
      .filter(url => url && url.includes('facebook.com/groups/'));
  }

  /**
   * Close the readline interface
   */
  close() {
    this.rl.close();
  }
}

