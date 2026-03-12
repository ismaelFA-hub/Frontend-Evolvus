/**
 * lib/analytics.ts — Lightweight event-tracking service for Evolvus.
 *
 * Design goals:
 * 1. Zero external dependencies — works offline via AsyncStorage queue.
 * 2. Mixpanel-ready: call analytics.setAdapter(mixpanelAdapter) to upgrade.
 * 3. Sentry-ready: errors tracked via trackError() with structured metadata.
 * 4. Tree-shakeable — consumers import only what they need.
 *
 * Usage:
 *   import { analytics } from '@/lib/analytics';
 *   analytics.track('onboarding_complete', { slide: 5 });
 *   analytics.screen('Dashboard');
 *   analytics.identify(userId, { plan: 'Pro' });
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AnalyticsEventName =
  | 'session_start'
  | 'session_end'
  | 'onboarding_step'
  | 'onboarding_complete'
  | 'onboarding_skipped'
  | 'tab_navigate'
  | 'tutorial_viewed'
  | 'tutorial_started'
  | 'fab_dismissed'
  | 'tooltip_viewed'
  | 'tooltip_dismissed'
  | 'trade_submit'
  | 'bot_created'
  | 'bot_started'
  | 'bot_stopped'
  | 'language_changed'
  | 'plan_upgrade_tapped'
  | 'error_caught'
  | string; // allow custom events without breaking the type

export interface AnalyticsEvent {
  /** Event name (snake_case) */
  name: AnalyticsEventName;
  /** Arbitrary event properties */
  properties: Record<string, unknown>;
  /** ISO timestamp at event creation */
  timestamp: string;
  /** Session ID (random, reset per app launch) */
  sessionId: string;
}

/** Pluggable adapter interface — implement to forward events to Mixpanel, Amplitude, etc. */
export interface AnalyticsAdapter {
  track(event: AnalyticsEvent): Promise<void> | void;
  identify?(userId: string, traits: Record<string, unknown>): Promise<void> | void;
  screen?(screenName: string, properties?: Record<string, unknown>): Promise<void> | void;
  flush?(): Promise<void>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const QUEUE_KEY = 'analytics_event_queue';
const SESSION_KEY = 'analytics_session_id';
const MAX_QUEUE = 200;

// ─── Utility ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ─── AnalyticsService ─────────────────────────────────────────────────────────

class AnalyticsService {
  private sessionId: string = generateId();
  private userId: string | null = null;
  private traits: Record<string, unknown> = {};
  private adapter: AnalyticsAdapter | null = null;
  private enabled: boolean = true;
  private _initialized: boolean = false;

  // ─── Public API ──────────────────────────────────────────────────────────

  /**
   * Call once at app startup (e.g. in _layout.tsx) to restore session and flush
   * any queued events.
   */
  async init(): Promise<void> {
    if (this._initialized) return;
    this._initialized = true;
    try {
      const stored = await AsyncStorage.getItem(SESSION_KEY);
      this.sessionId = stored || generateId();
      await AsyncStorage.setItem(SESSION_KEY, this.sessionId);
      await this._flushQueue();
    } catch (err) {
      if (__DEV__) console.warn('[Analytics] init() failed:', err);
    }
  }

  /** Plug in a Mixpanel/Amplitude/custom adapter. */
  setAdapter(adapter: AnalyticsAdapter): void {
    this.adapter = adapter;
  }

  /** Disable/enable all tracking (e.g. user opt-out in settings). */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /** Associate future events with a user ID + traits. */
  identify(userId: string, traits: Record<string, unknown> = {}): void {
    this.userId = userId;
    this.traits = { ...this.traits, ...traits };
    try {
      this.adapter?.identify?.(userId, this.traits);
    } catch (err) {
      if (__DEV__) console.warn('[Analytics] identify() adapter error:', err);
    }
  }

  /** Track a named event with optional properties. */
  track(name: AnalyticsEventName, properties: Record<string, unknown> = {}): void {
    if (!this.enabled) return;
    const event: AnalyticsEvent = {
      name,
      properties: {
        ...properties,
        ...(this.userId ? { userId: this.userId } : {}),
        ...this.traits,
      },
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
    };
    this._dispatch(event);
  }

  /** Track a screen view event. */
  screen(screenName: string, properties: Record<string, unknown> = {}): void {
    if (!this.enabled) return;
    try {
      this.adapter?.screen?.(screenName, properties);
    } catch (_) {}
    this.track('tab_navigate', { screen: screenName, ...properties });
  }

  /** Track a caught error (lightweight Sentry alternative). */
  trackError(error: Error, context: Record<string, unknown> = {}): void {
    this.track('error_caught', {
      message: error.message,
      stack: error.stack?.slice(0, 300),
      ...context,
    });
  }

  /** Reset session (e.g. on logout). */
  resetSession(): void {
    this.sessionId = generateId();
    this.userId = null;
    this.traits = {};
    try {
      AsyncStorage.setItem(SESSION_KEY, this.sessionId);
    } catch (_) {}
  }

  /** Return current session ID (useful for bug reports). */
  getSessionId(): string {
    return this.sessionId;
  }

  /** Return all queued events (for debugging / Sentry-style export). */
  async getQueue(): Promise<AnalyticsEvent[]> {
    try {
      const raw = await AsyncStorage.getItem(QUEUE_KEY);
      return raw ? (JSON.parse(raw) as AnalyticsEvent[]) : [];
    } catch (_) {
      return [];
    }
  }

  /** Flush queued events to the adapter and clear the queue. */
  async flush(): Promise<void> {
    await this._flushQueue();
    await this.adapter?.flush?.();
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  private async _dispatch(event: AnalyticsEvent): Promise<void> {
    // If adapter is available, try to send immediately
    if (this.adapter) {
      try {
        await this.adapter.track(event);
        return; // sent successfully, no need to queue
      } catch (err) {
        if (__DEV__) console.warn('[Analytics] dispatch failed, enqueueing:', event.name, err);
      }
    }
    // Otherwise, enqueue for later delivery
    await this._enqueue(event);
  }

  private async _enqueue(event: AnalyticsEvent): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(QUEUE_KEY);
      const queue: AnalyticsEvent[] = raw ? (JSON.parse(raw) as AnalyticsEvent[]) : [];
      queue.push(event);
      // Trim to prevent unbounded growth
      if (queue.length > MAX_QUEUE) queue.splice(0, queue.length - MAX_QUEUE);
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    } catch (err) {
      if (__DEV__) console.warn('[Analytics] enqueue failed for event:', event.name, err);
    }
  }

  private async _flushQueue(): Promise<void> {
    if (!this.adapter) return;
    try {
      const raw = await AsyncStorage.getItem(QUEUE_KEY);
      const queue: AnalyticsEvent[] = raw ? (JSON.parse(raw) as AnalyticsEvent[]) : [];
      if (queue.length === 0) return;
      const failed: AnalyticsEvent[] = [];
      for (const event of queue) {
        try { await this.adapter.track(event); } catch (err) {
          if (__DEV__) console.warn('[Analytics] flush failed for event:', event.name, err);
          failed.push(event);
        }
      }
      // Re-enqueue only failed events so successful ones are cleared
      if (failed.length > 0) {
        await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(failed));
      } else {
        await AsyncStorage.removeItem(QUEUE_KEY);
      }
    } catch (err) {
      if (__DEV__) console.warn('[Analytics] flush error:', err);
    }
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const analytics = new AnalyticsService();
export default analytics;
