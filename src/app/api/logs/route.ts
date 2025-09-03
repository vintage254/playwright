import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs-extra';
import path from 'path';

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
}

/**
 * GET /api/logs - Get recent automation logs
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const logsPath = path.join(process.cwd(), 'logs', 'automation.log');
    const logs: LogEntry[] = [];

    if (await fs.pathExists(logsPath)) {
      try {
        const logContent = await fs.readFile(logsPath, 'utf8');
        const lines = logContent.split('\n').filter(line => line.trim());
        
        // Parse last 100 log entries
        const recentLines = lines.slice(-100);
        
        for (const line of recentLines) {
          try {
            // Try to parse as JSON first
            const logEntry = JSON.parse(line);
            logs.push({
              timestamp: logEntry.timestamp || new Date().toISOString(),
              level: logEntry.level || 'info',
              message: logEntry.message || line
            });
          } catch {
            // If not JSON, treat as plain text with timestamp extraction
            const timestampMatch = line.match(/^\[([^\]]+)\]/);
            const levelMatch = line.match(/\[(ERROR|WARN|INFO|DEBUG)\]/i);
            
            logs.push({
              timestamp: timestampMatch ? timestampMatch[1] : new Date().toISOString(),
              level: levelMatch ? levelMatch[1].toLowerCase() : 'info',
              message: line.replace(/^\[[^\]]+\]/, '').replace(/\[(ERROR|WARN|INFO|DEBUG)\]/i, '').trim()
            });
          }
        }
      } catch (error) {
        console.error('Error reading log file:', error);
        logs.push({
          timestamp: new Date().toISOString(),
          level: 'error',
          message: 'Failed to read log file'
        });
      }
    } else {
      logs.push({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'No logs available yet'
      });
    }

    return NextResponse.json({ logs });
  } catch (error) {
    console.error('Logs API error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve logs' }, 
      { status: 500 }
    );
  }
}
