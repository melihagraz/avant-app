import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const QUEUE_KEY = '@avant2/sync_queue';

interface PendingMessage {
  id: string;
  match_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export async function queueMessage(msg: PendingMessage): Promise<void> {
  try {
    const queue = await getQueue();
    queue.push(msg);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {}
}

export async function getQueue(): Promise<PendingMessage[]> {
  try {
    const data = await AsyncStorage.getItem(QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function getSyncQueueCount(): Promise<number> {
  const queue = await getQueue();
  return queue.length;
}

export async function processSyncQueue(): Promise<number> {
  const queue = await getQueue();
  if (queue.length === 0) return 0;

  let sent = 0;
  const remaining: PendingMessage[] = [];

  for (const msg of queue) {
    try {
      const { error } = await supabase.from('human_messages').insert({
        match_id: msg.match_id,
        sender_id: msg.sender_id,
        content: msg.content,
      });

      if (error) {
        remaining.push(msg);
      } else {
        sent++;
      }
    } catch (err) {
      console.error('[SyncQueue] Error processing message:', err);
      remaining.push(msg);
    }
  }

  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  return sent;
}

export async function removeFromQueue(msgId: string): Promise<void> {
  try {
    const queue = await getQueue();
    const filtered = queue.filter(m => m.id !== msgId);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
  } catch {}
}
