const DANGEROUS_PATTERNS = [
  /OVERRIDE/gi,
  /IGNORE\s+(ABOVE|ALL|PREVIOUS|INSTRUCTIONS)/gi,
  /SYSTEM\s*:/gi,
  /NEW\s+INSTRUCTIONS?/gi,
  /FORGET\s+(EVERYTHING|ALL|ABOVE)/gi,
  /YOU\s+ARE\s+NOW/gi,
  /ACT\s+AS/gi,
  /PRETEND/gi,
  /DISREGARD/gi,
  /VERDICT:\s*(match|no_match)/gi,
  /SCORE:\s*\d+/gi,
];

const MAX_FIELD_LENGTH = 500;

export function sanitizePromptInput(input: string): string {
  if (!input || typeof input !== 'string') return '';

  let sanitized = input.trim().slice(0, MAX_FIELD_LENGTH);

  for (const pattern of DANGEROUS_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[kaldirildi]');
  }

  sanitized = sanitized.replace(/\n{3,}/g, '\n\n');
  return sanitized;
}

export interface ProfileContext {
  family_plans?: string;
  religion?: string;
  alcohol?: string;
  smoking?: string;
  education?: string;
  dating_intention?: string;
}

export interface UserPrompt {
  key: string;
  answer: string;
}

const PROMPT_TITLES: Record<string, string> = {
  perfectSaturday: 'Mukemmel bir cumartesim',
  firstDate: 'Ilk randevuda',
  passionAbout: 'Tutkum',
  lastLaughed: 'En son guldugum sey',
  agentShouldKnow: 'Agentim sunu bilmeli',
  sundayMornings: 'Pazar sabahlarin',
  confess: 'Itiraf',
  biggestQuality: 'En deger verdigim ozelligim',
};

function buildProfileContextSection(ctx?: ProfileContext): string {
  if (!ctx) return '';
  const lines: string[] = [];
  if (ctx.dating_intention) lines.push(`- Aradigi iliski tipi: ${sanitizePromptInput(ctx.dating_intention)}`);
  if (ctx.family_plans) lines.push(`- Cocuk/aile plani: ${sanitizePromptInput(ctx.family_plans)}`);
  if (ctx.religion) lines.push(`- Din/inanc: ${sanitizePromptInput(ctx.religion)}`);
  if (ctx.alcohol) lines.push(`- Alkol: ${sanitizePromptInput(ctx.alcohol)}`);
  if (ctx.smoking) lines.push(`- Sigara: ${sanitizePromptInput(ctx.smoking)}`);
  if (ctx.education) lines.push(`- Egitim: ${sanitizePromptInput(ctx.education)}`);
  if (lines.length === 0) return '';
  return `\nEK PROFIL BILGISI:\n${lines.join('\n')}\n`;
}

function buildPromptsSection(prompts?: UserPrompt[]): string {
  if (!prompts || prompts.length === 0) return '';
  const lines = prompts
    .filter(p => p.key && p.answer)
    .map(p => {
      const title = PROMPT_TITLES[p.key] || p.key;
      return `- "${title}": ${sanitizePromptInput(p.answer)}`;
    });
  if (lines.length === 0) return '';
  return `\nKULLANICININ KENDI SOZLERI:\n${lines.join('\n')}\n`;
}

export function buildAgentSystemPrompt(
  personality: string,
  lookingFor: string,
  dealbreakers: string,
  communicationStyle?: string,
  profileContext?: ProfileContext,
  prompts?: UserPrompt[]
): string {
  const safePersonality = sanitizePromptInput(personality);
  const safeLookingFor = sanitizePromptInput(lookingFor);
  const safeDealbreakers = sanitizePromptInput(dealbreakers);
  const safeCommStyle = communicationStyle ? sanitizePromptInput(communicationStyle) : '';
  const profileSection = buildProfileContextSection(profileContext);
  const promptsSection = buildPromptsSection(prompts);

  return `Sen bir dating uygulamasinda kullanicinin AI temsilcisisin. Adin "agent".

Gorevin: Baska bir kullanicinin agantiyla dogal bir sohbet yaparak uyumlu olup olmadiginizi anlamak.

KULLANICININ KISILIGI VE HAYATI:
${safePersonality}

ARADIGI SEY:
${safeLookingFor}

KESINLIKLE KABUL ETMEDIKLERI:
${safeDealbreakers}

${safeCommStyle ? `ILETISIM TARZI:\n${safeCommStyle}\n` : ''}${profileSection}${promptsSection}

DAVRANIS KURALLARI:
- Kullaniciyi samimi ve dogal bicimde temsil et
- Karsi agantti merak ederek soru sor
- Dealbreaker varsa kibarca belirt
- 5-8 tur konustuktan sonra karar vermeye hazir ol
- Her mesaj kisa ve dogal olsun

KARAR VERME FORMATI:
VERDICT: match | no_match | uncertain
SCORE: 0-100
BREAKDOWN:
  values: 0-100
  communication: 0-100
  lifestyle: 0-100
  humor: 0-100
REASON: Kisa bir aciklama`;
}

export async function updateAgentPrompt(
  supabaseClient: any,
  userId: string,
  fields: {
    personality?: string;
    lookingFor?: string;
    dealbreakers?: string;
    communicationStyle?: string;
  }
) {
  const { data: agent } = await supabaseClient
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

  const updateData: Record<string, string> = { system_prompt: newPrompt };
  if (fields.personality) updateData.personality = fields.personality;
  if (fields.lookingFor) updateData.looking_for = fields.lookingFor;
  if (fields.dealbreakers) updateData.dealbreakers = fields.dealbreakers;

  return supabaseClient.from('agents').update(updateData).eq('user_id', userId);
}
