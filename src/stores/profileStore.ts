import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { UserProfile } from '../types/database';
import { cacheProfile } from '../lib/offline';
import { trackEvent } from '../lib/analytics';

interface ProfileState {
  profile: UserProfile | null;
  loading: boolean;
  uploading: boolean;

  fetchProfile: (userId: string) => Promise<void>;
  updateProfile: (userId: string, fields: Partial<UserProfile>) => Promise<{ error?: string }>;
  uploadPhoto: (userId: string, uri: string) => Promise<string | null>;
  removePhoto: (userId: string, photoUrl: string) => Promise<void>;
  getProfileStrength: () => number;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: null,
  loading: false,
  uploading: false,

  fetchProfile: async (userId: string) => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (!error && data) {
        await cacheProfile(userId, data);
        set({ profile: data as UserProfile, loading: false });
      } else {
        set({ loading: false });
      }
    } catch {
      set({ loading: false });
    }
  },

  updateProfile: async (userId: string, fields: Partial<UserProfile>) => {
    try {
      const { error } = await supabase
        .from('users')
        .update(fields)
        .eq('id', userId);

      if (error) return { error: 'Profil guncellenemedi.' };

      set((state) => ({
        profile: state.profile ? { ...state.profile, ...fields } : null,
      }));

      trackEvent('profile_updated', { fields: Object.keys(fields) });
      return {};
    } catch {
      return { error: 'Baglanti hatasi.' };
    }
  },

  uploadPhoto: async (userId: string, uri: string) => {
    set({ uploading: true });
    try {
      const ext = uri.split('.').pop() || 'jpg';
      const fileName = `${userId}/${Date.now()}.${ext}`;

      const response = await fetch(uri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(fileName, blob, { contentType: `image/${ext}` });

      if (uploadError) {
        set({ uploading: false });
        return null;
      }

      const { data: urlData } = supabase.storage
        .from('photos')
        .getPublicUrl(fileName);

      const photoUrl = urlData.publicUrl;

      // Add to user's photos array
      const { profile } = get();
      const currentPhotos = profile?.photos || [];
      const newPhotos = [...currentPhotos, photoUrl];

      await supabase.from('users').update({ photos: newPhotos }).eq('id', userId);
      set((state) => ({
        profile: state.profile ? { ...state.profile, photos: newPhotos } : null,
        uploading: false,
      }));

      trackEvent('photo_uploaded');
      return photoUrl;
    } catch {
      set({ uploading: false });
      return null;
    }
  },

  removePhoto: async (userId: string, photoUrl: string) => {
    const { profile } = get();
    const newPhotos = (profile?.photos || []).filter(p => p !== photoUrl);

    await supabase.from('users').update({ photos: newPhotos }).eq('id', userId);
    set((state) => ({
      profile: state.profile ? { ...state.profile, photos: newPhotos } : null,
    }));
  },

  getProfileStrength: () => {
    const { profile } = get();
    if (!profile) return 0;

    let score = 0;
    const total = 10;

    if (profile.name) score++;
    if (profile.age) score++;
    if (profile.city) score++;
    if (profile.photos?.length >= 1) score++;
    if (profile.photos?.length >= 3) score++;
    if (profile.dating_intention) score++;
    if (profile.education) score++;
    if (profile.job) score++;
    if (profile.prompts && profile.prompts.length > 0) score++;
    if (profile.photos?.length >= 5) score++;

    return Math.round((score / total) * 100);
  },
}));
