/**
 * Shared TypeScript interfaces for Facebook Automation
 */

import { Page } from 'playwright';

// Group-related interfaces
export interface GroupInfo {
  url: string;
  name: string;
  memberCount: number;
  isJoined: boolean;
  relevanceScore?: number;
  searchKeyword?: string;
  category?: string;
  description?: string;
}

export interface GroupSelection {
  joinedGroups: GroupInfo[];
  discoveredGroups: GroupInfo[];
  selectedGroups: GroupInfo[];
}

// Session management
export interface SessionData {
  cookies: any[];
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
  timestamp: string;
  userAgent: string;
}

// Automation configuration
export interface AutomationConfig {
  groupUrls: string[];
  joinGroups: boolean;
  createPosts: boolean;
  targetCategory: string;
  postContent?: string;
  imagePath?: string;
  delaySettings?: DelaySettings;
}

export interface DelaySettings {
  minDelay: number;
  maxDelay: number;
  typingSpeed: number;
  pageLoadTimeout: number;
}

// Logging and status
export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  category?: string;
}

export interface AutomationStats {
  groupsJoined: number;
  postsCreated: number;
  errors: number;
  interventions: number;
  startTime?: string;
  endTime?: string;
}

export interface AutomationStatus {
  status: 'idle' | 'running' | 'stopped' | 'paused' | 'discovering' | 'error';
  stats: AutomationStats;
  config?: AutomationConfig;
  lastActivity?: string;
}

// Alert system
export interface AlertConfig {
  soundEnabled: boolean;
  consoleAlerts: boolean;
  logAlerts: boolean;
  pauseOnAlert: boolean;
}

export interface InterventionAlert {
  type: 'popup' | 'captcha' | 'security_check' | 'rate_limit' | 'unknown';
  message: string;
  timestamp: string;
  screenshot?: string;
}

// Post management
export interface PostContent {
  text: string;
  imagePath?: string;
  hashtags?: string[];
  category: string;
}

export interface PostResult {
  success: boolean;
  groupUrl: string;
  groupName: string;
  error?: string;
  timestamp: string;
}

// Browser and selectors
export interface BrowserConfig {
  headless: boolean;
  args: string[];
  viewport: { width: number; height: number };
  userAgent: string;
  locale: string;
}

export interface FacebookSelectors {
  login: {
    email: string;
    password: string;
    submitButton: string;
  };
  groups: {
    searchBox: string;
    searchResults: string;
    joinButton: string;
    membershipQuestions: string;
  };
  posts: {
    createPost: string;
    textArea: string;
    imageUpload: string;
    publishButton: string;
  };
  navigation: {
    groupsMenu: string;
    yourGroups: string;
    notifications: string;
  };
}

// Utility types
export type CategoryType = 
  | 'all'
  | 'affiliate'
  | 'handmade'
  | 'freelancing'
  | 'ecommerce'
  | 'marketing'
  | 'webdev'
  | 'lifestyle'
  | 'business';

export type PageHandler = (page: Page) => Promise<void>;

export type GroupDiscoveryMethod = 'joined' | 'search' | 'manual';

// Error types
export class AutomationError extends Error {
  constructor(
    message: string,
    public code: string,
    public category: 'login' | 'navigation' | 'interaction' | 'network' = 'interaction'
  ) {
    super(message);
    this.name = 'AutomationError';
  }
}
