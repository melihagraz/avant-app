export interface ModerationResult {
  clean: boolean;
  reason?: string;
}

const TR_PROFANITY = [
  'amk', 'aq', 'amcik', 'amina',
  'orospu', 'oruspu', 'orsp',
  'pic', 'pezevenk',
  'sik', 'sikerim', 'sikeyim', 'siktir',
  'got', 'gotun',
  'yarak', 'yarrak', 'tassak',
  'kahpe', 'kaltak', 'surtuk',
  'gavat', 'ibne', 'pust',
  'bok', 'boktan', 'haysiyetsiz',
  'gerizekali', 'salak', 'aptal', 'mal',
  'anani', 'bacini',
];

const EN_PROFANITY = [
  'fuck', 'shit', 'bitch', 'asshole', 'dick', 'cock',
  'pussy', 'cunt', 'whore', 'slut', 'bastard',
  'nigger', 'faggot', 'retard',
  'motherfucker', 'bullshit', 'goddamn',
  'wanker', 'twat', 'prick',
];

const allWords = [...TR_PROFANITY, ...EN_PROFANITY].join('|');
const profanityRegex = new RegExp(
  '(?:^|\\s|[.,!?])(' + allWords + ')(?:\\s|[.,!?]|$)',
  'i'
);

const CONTACT_PATTERNS = [
  /(\+?90|0)[\s\-.]?\d{3}[\s\-.]?\d{3}[\s\-.]?\d{2}[\s\-.]?\d{2}/,
  /\d[\s\-.]?\d[\s\-.]?\d[\s\-.]?\d[\s\-.]?\d[\s\-.]?\d[\s\-.]?\d+/,
  /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/,
  /(?:instagram|insta|snap(?:chat)?|telegram|whatsapp|wp|tiktok|twitter|x\.com)[\s:./]?\s*@?\w{3,}/i,
  /@[a-zA-Z0-9_]{3,}/,
  /https?:\/\/\S+/i,
  /www\.\S+/i,
];

const SPAM_PATTERNS = [
  /(.)\1{5,}/,
  /[A-Z\s]{20,}/,
];

const HARASSMENT_PATTERNS = [
  /\boldur/i,
  /\bintihar/i,
  /\bkendini\s+oldur/i,
  /\bseni\s+bulurum/i,
  /\badresini\s+biliyorum/i,
  /\btehdit/i,
];

export function moderateText(text: string): ModerationResult {
  if (!text || typeof text !== 'string') return { clean: true };

  const normalized = text.toLowerCase().trim();

  if (profanityRegex.test(normalized)) {
    return { clean: false, reason: 'profanity' };
  }

  for (const pattern of HARASSMENT_PATTERNS) {
    if (pattern.test(normalized)) {
      return { clean: false, reason: 'harassment' };
    }
  }

  for (const pattern of CONTACT_PATTERNS) {
    if (pattern.test(text)) {
      return { clean: false, reason: 'contact_info' };
    }
  }

  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(text)) {
      return { clean: false, reason: 'spam' };
    }
  }

  return { clean: true };
}

export function getModerationMessage(reason: string): string {
  switch (reason) {
    case 'profanity': return 'Kufur iceren mesajlar gonderilemez.';
    case 'harassment': return 'Taciz iceren mesajlar gonderilemez.';
    case 'contact_info': return 'Iletisim bilgisi paylasilamaz.';
    case 'spam': return 'Spam tespit edildi.';
    default: return 'Bu mesaj gonderilemez.';
  }
}
