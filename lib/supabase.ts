import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  'https://ertyxalazqtmdowjdzsq.supabase.co',
  'sb_publishable_MYoZp-UGpXA8s4JzutonGQ_YUOr2-FB',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  }
);