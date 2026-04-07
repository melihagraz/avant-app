// supabase/functions/delete-user/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // JWT'den authenticated user'ı doğrula
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization header required' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Token'dan user'ı al ve body'deki user_id ile karşılaştır
    const anonClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user: authUser }, error: authErr } = await anonClient.auth.getUser();
    if (authErr || !authUser) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { user_id } = await req.json();
    if (!user_id) throw new Error('user_id required');

    // Kullanıcı sadece kendi hesabını silebilir
    if (authUser.id !== user_id) {
      return new Response(JSON.stringify({ error: 'Unauthorized: can only delete own account' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Agent ID'lerini bul
    const { data: agentData } = await supabase
      .from('agents')
      .select('id')
      .eq('user_id', user_id);
    const agentIds = agentData?.map((a: any) => a.id) || [];

    // 2. Match ID'lerini bul
    const { data: matchData } = await supabase
      .from('matches')
      .select('id')
      .or(`user_a_id.eq.${user_id},user_b_id.eq.${user_id}`);
    const matchIds = matchData?.map((m: any) => m.id) || [];

    // 3. Human mesajlarını sil
    if (matchIds.length > 0) {
      await supabase.from('human_messages').delete().in('match_id', matchIds);
    }

    // 4. Matches sil
    if (matchIds.length > 0) {
      await supabase.from('matches').delete().in('id', matchIds);
    }

    // 5. Agent conversation'ları sil (agent_a veya agent_b olarak)
    if (agentIds.length > 0) {
      // Önce agent_a_id ile olanlar
      const { data: convA } = await supabase
        .from('agent_conversations')
        .select('id')
        .in('agent_a_id', agentIds);
      const convAIds = convA?.map((c: any) => c.id) || [];

      // Sonra agent_b_id ile olanlar
      const { data: convB } = await supabase
        .from('agent_conversations')
        .select('id')
        .in('agent_b_id', agentIds);
      const convBIds = convB?.map((c: any) => c.id) || [];

      const allConvIds = [...new Set([...convAIds, ...convBIds])];
      if (allConvIds.length > 0) {
        await supabase.from('agent_conversations').delete().in('id', allConvIds);
      }

      // 6. Match queue'yu sil
      await supabase.from('match_queue').delete().in('agent_a_id', agentIds);
      await supabase.from('match_queue').delete().in('agent_b_id', agentIds);

      // 7. Agent'ı sil
      await supabase.from('agents').delete().eq('user_id', user_id);
    }

    // 8. Filter stats sil
    await supabase.from('filter_stats').delete().eq('user_id', user_id);

    // 9. Users tablosundan sil
    await supabase.from('users').delete().eq('id', user_id);

    // 10. Auth'dan sil (en son — bu başarısız olursa üsttekiler geri alınamaz ama auth user kalsa bile DB temiz)
    const { error: authError } = await supabase.auth.admin.deleteUser(user_id);
    if (authError) {
      console.error(`Auth delete error for ${user_id}:`, authError);
      // Hata fırlat ama DB zaten temizlendi
      throw authError;
    }

    console.log(`User fully deleted: ${user_id}`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Delete user error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
