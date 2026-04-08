import AsyncStorage from '@react-native-async-storage/async-storage';
import { queueMessage, getQueue, getSyncQueueCount, processSyncQueue, removeFromQueue } from '../../lib/syncQueue';

// Mock supabase
const mockInsert = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      insert: mockInsert,
    })),
  },
}));

jest.mock('../../lib/sentry', () => ({
  captureError: jest.fn(),
}));

const testMsg = {
  id: 'temp-1',
  match_id: 'm1',
  sender_id: 'u1',
  content: 'Hello!',
  created_at: '2026-01-01T00:00:00Z',
};

describe('syncQueue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  });

  it('should queue a message', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
    await queueMessage(testMsg);

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      '@avant/sync_queue',
      JSON.stringify([testMsg])
    );
  });

  it('should return empty queue initially', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
    const queue = await getQueue();
    expect(queue).toEqual([]);
  });

  it('should return queue count', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify([testMsg]));
    const count = await getSyncQueueCount();
    expect(count).toBe(1);
  });

  it('should process queue and send messages', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify([testMsg]));
    mockInsert.mockResolvedValueOnce({ error: null });

    const sent = await processSyncQueue();
    expect(sent).toBe(1);
    expect(mockInsert).toHaveBeenCalledWith({
      match_id: 'm1',
      sender_id: 'u1',
      content: 'Hello!',
    });
  });

  it('should keep failed messages in queue', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify([testMsg]));
    mockInsert.mockResolvedValueOnce({ error: { message: 'Network error' } });

    const sent = await processSyncQueue();
    expect(sent).toBe(0);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      '@avant/sync_queue',
      JSON.stringify([testMsg])
    );
  });

  it('should remove specific message from queue', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify([testMsg]));
    await removeFromQueue('temp-1');

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      '@avant/sync_queue',
      JSON.stringify([])
    );
  });
});
