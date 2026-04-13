import { supabase } from './supabase';

let currentUserId: string | null = null;
let eventQueue: { event_name: string; properties?: Record<string, any>; screen?: string }[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

const FLUSH_INTERVAL = 5000;
const MAX_QUEUE_SIZE = 20;

export function setAnalyticsUser(userId: string | null) {
  currentUserId = userId;
}

export function trackEvent(eventName: string, properties?: Record<string, any>) {
  eventQueue.push({ event_name: eventName, properties });
  if (eventQueue.length >= MAX_QUEUE_SIZE) {
    flush();
  } else if (!flushTimer) {
    flushTimer = setTimeout(flush, FLUSH_INTERVAL);
  }
}

export function trackScreen(screenName: string) {
  eventQueue.push({ event_name: 'screen_view', screen: screenName });
  if (!flushTimer) {
    flushTimer = setTimeout(flush, FLUSH_INTERVAL);
  }
}

async function flush() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  if (eventQueue.length === 0) return;

  const batch = eventQueue.splice(0, eventQueue.length);

  const rows = batch.map((e) => ({
    user_id: currentUserId,
    event_name: e.event_name,
    properties: e.properties || {},
    screen: e.screen || null,
  }));

  try {
    await supabase.from('analytics_events').insert(rows);
  } catch {
    // Silent failure
  }
}
