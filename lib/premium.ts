import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import { captureError } from './sentry';

export function usePremiumStatus() {
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);

  const check = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data } = await supabase
        .from('users')
        .select('is_premium')
        .eq('id', user.id)
        .single();

      setIsPremium(data?.is_premium || false);
    } catch (err) {
      captureError(err, { context: 'check_premium' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  return { isPremium, loading, refresh: check };
}

export async function checkPremium(): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data } = await supabase
      .from('users')
      .select('is_premium')
      .eq('id', user.id)
      .single();

    return data?.is_premium || false;
  } catch {
    return false;
  }
}
