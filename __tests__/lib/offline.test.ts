import AsyncStorage from '@react-native-async-storage/async-storage';
import { cacheProfile, getCachedProfile, cacheMatches, getCachedMatches, cacheMessages, getCachedMessages } from '../../lib/offline';

describe('offline cache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('profile cache', () => {
    it('should cache and retrieve profile', async () => {
      const profile = { id: 'u1', name: 'Test', age: 25 };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(profile));

      await cacheProfile('u1', profile);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@avant/profile/u1',
        JSON.stringify(profile)
      );

      const cached = await getCachedProfile('u1');
      expect(cached).toEqual(profile);
    });

    it('should return null for uncached profile', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
      const result = await getCachedProfile('unknown');
      expect(result).toBeNull();
    });
  });

  describe('matches cache', () => {
    it('should cache and retrieve matches', async () => {
      const matches = [{ id: 'm1' }, { id: 'm2' }];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(matches));

      await cacheMatches('u1', matches);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@avant/matches/u1',
        JSON.stringify(matches)
      );

      const cached = await getCachedMatches('u1');
      expect(cached).toEqual(matches);
    });

    it('should return empty array for uncached matches', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
      const result = await getCachedMatches('unknown');
      expect(result).toEqual([]);
    });
  });

  describe('messages cache', () => {
    it('should cache and retrieve messages', async () => {
      const messages = [{ id: 'msg1', content: 'Hello' }];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(messages));

      await cacheMessages('m1', messages);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@avant/messages/m1',
        JSON.stringify(messages)
      );

      const cached = await getCachedMessages('m1');
      expect(cached).toEqual(messages);
    });

    it('should return empty array for uncached messages', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
      const result = await getCachedMessages('unknown');
      expect(result).toEqual([]);
    });
  });
});
