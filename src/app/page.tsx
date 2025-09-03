'use client';

/**
 * Facebook Automation Dashboard
 * Next.js App Router dashboard for monitoring and controlling automation
 */

import { useState, useEffect } from 'react';
import styles from './dashboard.module.css';

interface Stats {
  groupsJoined: number;
  postsCreated: number;
  errors: number;
  interventions: number;
}

interface Config {
  groupUrls: string[];
  joinGroups: boolean;
  createPosts: boolean;
  targetCategory: string;
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
}

export default function Dashboard() {
  const [automationStatus, setAutomationStatus] = useState<string>('idle');
  const [stats, setStats] = useState<Stats>({
    groupsJoined: 0,
    postsCreated: 0,
    errors: 0,
    interventions: 0
  });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [config, setConfig] = useState<Config>({
    groupUrls: [],
    joinGroups: true,
    createPosts: true,
    targetCategory: 'all'
  });

  // Fetch automation status and stats
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch('/api/status');
        const data = await response.json();
        setAutomationStatus(data.status);
        setStats(data.stats);
      } catch (error) {
        console.error('Error fetching status:', error);
      }
    };

    const interval = setInterval(fetchStatus, 2000);
    fetchStatus();
    return () => clearInterval(interval);
  }, []);

  // Fetch logs
  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await fetch('/api/logs');
        const data = await response.json();
        setLogs(data.logs);
      } catch (error) {
        console.error('Error fetching logs:', error);
      }
    };

    const interval = setInterval(fetchLogs, 5000);
    fetchLogs();
    return () => clearInterval(interval);
  }, []);

  const handleStartAutomation = async () => {
    try {
      const response = await fetch('/api/automation/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      
      if (response.ok) {
        setAutomationStatus('running');
      }
    } catch (error) {
      console.error('Error starting automation:', error);
    }
  };

  const handleStopAutomation = async () => {
    try {
      await fetch('/api/automation/stop', { method: 'POST' });
      setAutomationStatus('stopped');
    } catch (error) {
      console.error('Error stopping automation:', error);
    }
  };

  const handleDiscoverGroups = async () => {
    try {
      setAutomationStatus('discovering');
      const response = await fetch('/api/groups/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: config.targetCategory })
      });
      
      const data = await response.json();
      setConfig(prev => ({ ...prev, groupUrls: data.groups || [] }));
      setAutomationStatus('idle');
    } catch (error) {
      console.error('Error discovering groups:', error);
      setAutomationStatus('idle');
    }
  };

  const getStatusColor = (): string => {
    switch (automationStatus) {
      case 'running': return '#28a745';
      case 'stopped': return '#dc3545';
      case 'paused': return '#ffc107';
      case 'discovering': return '#17a2b8';
      default: return '#6c757d';
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>🤖 Facebook Automation Dashboard</h1>
        <p>Educational cybersecurity & web developer marketing tool</p>
      </header>

      <main className={styles.main}>
        {/* Status Panel */}
        <div className={styles.statusPanel}>
          <div className={styles.statusCard}>
            <h2>System Status</h2>
            <div 
              className={styles.statusIndicator}
              style={{ backgroundColor: getStatusColor() }}
            >
              {automationStatus.toUpperCase()}
            </div>
          </div>

          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <h3>Groups Joined</h3>
              <span className={styles.statNumber}>{stats.groupsJoined}</span>
            </div>
            <div className={styles.statCard}>
              <h3>Posts Created</h3>
              <span className={styles.statNumber}>{stats.postsCreated}</span>
            </div>
            <div className={styles.statCard}>
              <h3>Manual Interventions</h3>
              <span className={styles.statNumber}>{stats.interventions}</span>
            </div>
            <div className={styles.statCard}>
              <h3>Errors</h3>
              <span className={styles.statNumber}>{stats.errors}</span>
            </div>
          </div>
        </div>

        {/* Control Panel */}
        <div className={styles.controlPanel}>
          <h2>🎮 Control Panel</h2>
          
          <div className={styles.configSection}>
            <h3>Target Market</h3>
            <select 
              value={config.targetCategory}
              onChange={(e) => setConfig(prev => ({ ...prev, targetCategory: e.target.value }))}
              className={styles.select}
            >
              <option value="all">All Categories (Maximum Reach)</option>
              <option value="affiliate">Affiliate Marketing Groups</option>
              <option value="handmade">Handmade Crafts & DIY Groups</option>
              <option value="freelancing">Freelancing & Remote Work Groups</option>
              <option value="ecommerce">E-commerce & Dropshipping Groups</option>
              <option value="marketing">Digital Marketing & SEO Groups</option>
              <option value="webdev">Web Development & Programming Groups</option>
              <option value="lifestyle">Fashion, Beauty & Lifestyle Groups</option>
            </select>
          </div>

          <div className={styles.buttonGroup}>
            <button 
              onClick={handleDiscoverGroups}
              disabled={automationStatus === 'running' || automationStatus === 'discovering'}
              className={`${styles.button} ${styles.discoverButton}`}
            >
              🔍 Discover Groups
            </button>

            <button 
              onClick={handleStartAutomation}
              disabled={automationStatus === 'running' || config.groupUrls.length === 0}
              className={`${styles.button} ${styles.startButton}`}
            >
              ▶️ Start Automation
            </button>

            <button 
              onClick={handleStopAutomation}
              disabled={automationStatus !== 'running'}
              className={`${styles.button} ${styles.stopButton}`}
            >
              ⏹️ Stop Automation
            </button>
          </div>

          <div className={styles.optionsSection}>
            <label className={styles.checkbox}>
              <input 
                type="checkbox" 
                checked={config.joinGroups}
                onChange={(e) => setConfig(prev => ({ ...prev, joinGroups: e.target.checked }))}
              />
              Join discovered groups automatically
            </label>

            <label className={styles.checkbox}>
              <input 
                type="checkbox" 
                checked={config.createPosts}
                onChange={(e) => setConfig(prev => ({ ...prev, createPosts: e.target.checked }))}
              />
              Create marketing posts in groups
            </label>
          </div>
        </div>

        {/* Groups Panel */}
        <div className={styles.groupsPanel}>
          <h2>📋 Selected Groups ({config.groupUrls.length})</h2>
          <div className={styles.groupsList}>
            {config.groupUrls.length === 0 ? (
              <p className={styles.emptyState}>No groups selected. Click "Discover Groups" to find targets.</p>
            ) : (
              config.groupUrls.slice(0, 10).map((url, index) => (
                <div key={index} className={styles.groupItem}>
                  <span>📍 {url.split('/').pop()}</span>
                </div>
              ))
            )}
            {config.groupUrls.length > 10 && (
              <p className={styles.moreGroups}>...and {config.groupUrls.length - 10} more groups</p>
            )}
          </div>
        </div>

        {/* Logs Panel */}
        <div className={styles.logsPanel}>
          <h2>📝 Activity Logs</h2>
          <div className={styles.logsList}>
            {logs.length === 0 ? (
              <p className={styles.emptyState}>No recent activity</p>
            ) : (
              logs.slice(-50).reverse().map((log, index) => (
                <div key={index} className={`${styles.logItem} ${styles[log.level] || ''}`}>
                  <span className={styles.logTime}>{new Date(log.timestamp).toLocaleTimeString()}</span>
                  <span className={styles.logMessage}>{log.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      <footer className={styles.footer}>
        <p>⚠️ Educational purposes only - Cybersecurity learning & legitimate marketing</p>
      </footer>
    </div>
  );
}
