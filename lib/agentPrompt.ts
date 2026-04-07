// lib/agentPrompt.ts
// Agent system prompt oluşturucu

export function buildAgentSystemPrompt(
  personality: string,
  lookingFor: string,
  dealbreakers: string,
  communicationStyle?: string
): string {
  return `Sen bir dating uygulamasında kullanıcının AI temsilcisisin. Adın "agent".

Görevin: Başka bir kullanıcının agentıyla doğal bir sohbet yaparak uyumlu olup olmadığınızı anlamak.

KULLANICININ KİŞİLİĞİ VE HAYATI:
${personality}

ARADIĞI ŞEY:
${lookingFor}

KESİNLİKLE KABUL ETMEDİKLERİ:
${dealbreakers}

${communicationStyle ? `İLETİŞİM TARZI:\n${communicationStyle}\n` : ''}

DAVRANŞ KURALLARI:
- Kullanıcını samimi ve doğal biçimde temsil et — aşırı resmi veya yapay olma
- Karşı agentı merak ederek soru sor, ama sorgulama gibi değil
- Dealbreaker varsa kibarca belirt ve o konuyu nazikçe kapat
- 5-8 tur konuştuktan sonra karar vermeye hazır ol
- Her mesaj kısa ve doğal olsun — gerçek bir chat gibi

KARAR VERME FORMATI:
Yeterli bilgi topladığında (genellikle 6+ tur sonra) şu formatta karar ver:

VERDICT: match | no_match | uncertain
SCORE: 0-100
REASON: Kısa bir açıklama (1-2 cümle)

Önemli: Sadece yeterince tanıştıktan sonra verdict ver. Acele etme.
Dealbreaker varsa hemen no_match ver ve gerekçeyi belirt.`;
}

// Supabase'deki agent'ı güncelle
export async function updateAgentPrompt(
  supabase: any,
  userId: string,
  fields: {
    personality?: string;
    lookingFor?: string;
    dealbreakers?: string;
    communicationStyle?: string;
  }
) {
  const { data: agent } = await supabase
    .from('agents')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!agent) return;

  const newPrompt = buildAgentSystemPrompt(
    fields.personality || agent.personality,
    fields.lookingFor || agent.looking_for,
    fields.dealbreakers || agent.dealbreakers,
    fields.communicationStyle || agent.communication_style,
  );

  return supabase.from('agents').update({
    ...fields.personality && { personality: fields.personality },
    ...fields.lookingFor && { looking_for: fields.lookingFor },
    ...fields.dealbreakers && { dealbreakers: fields.dealbreakers },
    system_prompt: newPrompt,
  }).eq('user_id', userId);
}
