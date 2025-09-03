import { NextRequest, NextResponse } from 'next/server';
import { chromium, Page } from 'playwright';
import fs from 'fs-extra';
import path from 'path';
import { GroupInfo } from '@/types/automation';
import { CategoryType } from '@/types/types';

interface DiscoveryRequest {
  category: string;
}

/**
 * POST /api/groups/discover - Discover Facebook groups by category
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { category }: DiscoveryRequest = await request.json();
    
    if (!category) {
      return NextResponse.json(
        { error: 'Category is required' },
        { status: 400 }
      );
    }

    // Dynamic imports for automation modules
    const { getBrowserConfig } = await import('../../../../config/browser-config');
    const { default: SessionManager } = await import('../../../../lib/session-manager');
    const { GroupDiscovery } = await import('../../../../lib/group-discovery');

    let browser;
    let page;
    const discoveredGroups: GroupInfo[] = [];

    try {
      // Launch browser with stealth configuration
      const browserConfig = getBrowserConfig();
      browser = await chromium.launch(browserConfig);
      const context = await browser.newContext();
      page = await context.newPage();

      // Initialize session manager
      const sessionManager = new SessionManager();
      
      // Try to restore session
      const loggedIn = await sessionManager.loadSession(context, page);
      if (!loggedIn) {
        return NextResponse.json(
          { 
          error: 'Unauthorized: No valid Facebook session found. Please run the main automation script to log in before using API endpoints.' 
        },
          { status: 401 }
        );
      }

      // Initialize group discovery
      const groupDiscovery = new GroupDiscovery(page);
      
      // Discover groups for the specified category
      console.log(`Starting group discovery for category: ${category}`);
      
      let combinedGroups: GroupInfo[] = [];
      
      // Get joined groups first
      const joinedGroups = await groupDiscovery.getJoinedGroups();
      console.log(`Found ${joinedGroups.length} joined groups`);
      
      // Search for new groups in the specified category
      const newGroups = await groupDiscovery.getTargetMarketingGroups(category as CategoryType);
      console.log(`Found ${newGroups.length} new groups for category: ${category}`);
      
      // Combine and deduplicate
      const allGroups = [...joinedGroups, ...newGroups];
      const uniqueGroups = groupDiscovery.removeDuplicateGroups(allGroups);
      
      // Sort by relevance score (highest first)
      combinedGroups = uniqueGroups.sort((a: GroupInfo, b: GroupInfo) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
      
      console.log(`Total unique groups discovered: ${combinedGroups.length}`);

      // Log discovery results
      const logDir = path.join(process.cwd(), 'logs');
      await fs.ensureDir(logDir);
      const logPath = path.join(logDir, 'automation.log');
      const logEntry = JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Group discovery completed for ${category}: found ${combinedGroups.length} unique groups`
      }) + '\n';
      await fs.appendFile(logPath, logEntry);

      return NextResponse.json({ 
        success: true,
        groups: combinedGroups.map(group => group.url),
        groupDetails: combinedGroups,
        category,
        count: combinedGroups.length
      });

    } catch (error) {
      console.error('Group discovery error:', error);
      
      // Log error
      const logDir = path.join(process.cwd(), 'logs');
      await fs.ensureDir(logDir);
      const logPath = path.join(logDir, 'automation.log');
      const logEntry = JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: `Group discovery failed for ${category}: ${error instanceof Error ? error.message : 'Unknown error'}`
      }) + '\n';
      await fs.appendFile(logPath, logEntry);

      return NextResponse.json(
        { error: `Group discovery failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
        { status: 500 }
      );
    } finally {
      if (browser) {
        await browser.close();
      }
    }

  } catch (error) {
    console.error('Groups discovery API error:', error);
    return NextResponse.json(
      { error: 'Failed to process group discovery request' },
      { status: 500 }
    );
  }
}
