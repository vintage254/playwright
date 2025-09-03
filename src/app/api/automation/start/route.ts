import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs-extra';
import path from 'path';
import { spawn } from 'child_process';

interface AutomationConfig {
  groupUrls: string[];
  joinGroups: boolean;
  createPosts: boolean;
  targetCategory: string;
}

/**
 * POST /api/automation/start - Start the automation process
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const config: AutomationConfig = await request.json();
    
    // Validate configuration
    if (!config.groupUrls || config.groupUrls.length === 0) {
      return NextResponse.json(
        { error: 'No groups specified. Please discover groups first.' },
        { status: 400 }
      );
    }

    // Save configuration
    const configPath = path.join(process.cwd(), 'automation-config.json');
    await fs.writeJson(configPath, config, { spaces: 2 });

    // Update status
    const statusPath = path.join(process.cwd(), 'automation-status.json');
    const status = {
      status: 'running',
      startTime: new Date().toISOString(),
      config,
      stats: {
        groupsJoined: 0,
        postsCreated: 0,
        errors: 0,
        interventions: 0
      }
    };
    await fs.writeJson(statusPath, status, { spaces: 2 });

    // Start automation process
    const mainScriptPath = path.join(process.cwd(), 'main');
    const child = spawn('node', [mainScriptPath, '--automated'], {
      detached: true,
      stdio: 'ignore',
      cwd: process.cwd()
    });

    child.unref();

    // Log process start
    const logDir = path.join(process.cwd(), 'logs');
    await fs.ensureDir(logDir);
    const logPath = path.join(logDir, 'automation.log');
    const logEntry = JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: `Automation started with ${config.groupUrls.length} target groups`
    }) + '\n';
    await fs.appendFile(logPath, logEntry);

    return NextResponse.json({ 
      success: true, 
      message: 'Automation started successfully',
      pid: child.pid 
    });

  } catch (error) {
    console.error('Start automation error:', error);
    return NextResponse.json(
      { error: 'Failed to start automation' },
      { status: 500 }
    );
  }
}
