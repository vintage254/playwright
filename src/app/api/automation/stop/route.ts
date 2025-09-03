import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs-extra';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * POST /api/automation/stop - Stop the automation process
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Update status to stopped
    const statusPath = path.join(process.cwd(), 'automation-status.json');
    const status = {
      status: 'stopped',
      stopTime: new Date().toISOString(),
      stats: {
        groupsJoined: 0,
        postsCreated: 0,
        errors: 0,
        interventions: 0
      }
    };

    if (await fs.pathExists(statusPath)) {
      try {
        const currentStatus = await fs.readJson(statusPath);
        status.stats = currentStatus.stats || status.stats;
      } catch (error) {
        console.error('Error reading current status:', error);
      }
    }

    await fs.writeJson(statusPath, status, { spaces: 2 });

    // Try to kill any running automation processes
    try {
      // Kill processes by name (Windows)
      await execAsync('taskkill /F /IM node.exe /FI "WINDOWTITLE eq Facebook Automation*"');
    } catch (error) {
      // Process might not be running, which is fine
      console.log('No automation processes found to stop');
    }

    // Log stop event
    const logDir = path.join(process.cwd(), 'logs');
    await fs.ensureDir(logDir);
    const logPath = path.join(logDir, 'automation.log');
    const logEntry = JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'Automation stopped via dashboard'
    }) + '\n';
    await fs.appendFile(logPath, logEntry);

    return NextResponse.json({ 
      success: true, 
      message: 'Automation stopped successfully' 
    });

  } catch (error) {
    console.error('Stop automation error:', error);
    return NextResponse.json(
      { error: 'Failed to stop automation' },
      { status: 500 }
    );
  }
}
