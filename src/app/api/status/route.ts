import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs-extra';
import path from 'path';

interface AutomationStatus {
  status: string;
  stats: {
    groupsJoined: number;
    postsCreated: number;
    errors: number;
    interventions: number;
  };
}

/**
 * GET /api/status - Get automation status and statistics
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const statusPath = path.join(process.cwd(), 'automation-status.json');
    const logsPath = path.join(process.cwd(), 'logs', 'automation.log');
    
    let status: AutomationStatus = {
      status: 'idle',
      stats: {
        groupsJoined: 0,
        postsCreated: 0,
        errors: 0,
        interventions: 0
      }
    };

    // Read status file if it exists
    if (await fs.pathExists(statusPath)) {
      try {
        status = await fs.readJson(statusPath);
      } catch (error) {
        console.error('Error reading status file:', error);
      }
    }

    // Count stats from logs if available
    if (await fs.pathExists(logsPath)) {
      try {
        const logContent = await fs.readFile(logsPath, 'utf8');
        const lines = logContent.split('\n');
        
        status.stats.groupsJoined = lines.filter(line => 
          line.includes('Successfully joined group') || line.includes('Group joined successfully')
        ).length;
        
        status.stats.postsCreated = lines.filter(line => 
          line.includes('Post created successfully') || line.includes('Posted successfully')
        ).length;
        
        status.stats.errors = lines.filter(line => 
          line.includes('ERROR') || line.includes('Error:')
        ).length;
        
        status.stats.interventions = lines.filter(line => 
          line.includes('Manual intervention required') || line.includes('INTERVENTION')
        ).length;
      } catch (error) {
        console.error('Error reading log file:', error);
      }
    }

    return NextResponse.json(status);
  } catch (error) {
    console.error('Status API error:', error);
    return NextResponse.json(
      { error: 'Failed to get automation status' }, 
      { status: 500 }
    );
  }
}
