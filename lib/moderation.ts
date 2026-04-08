// İçerik moderasyonu — küfür, iletişim bilgisi paylaşımı, spam tespiti

export interface ModerationResult {
  clean: boolean;
  reason?: string;
}

// Türkçe küfür/hakaret (kökler — varyasyonları yakalamak için)
const TR_PROFANITY = [
  'amk', 'aq', 'amcık', 'amcik', 'amına', 'amina',
  'orospu', 'oruspu', 'orsp',
  'piç', 'pic', 'pezevenk',
  'sik', 'sikerim', 'sikeyim', 'siktir', 'siktir',
  'göt', 'got', 'götün', 'gotun',
  'yarak', 'yarrak', 'taşşak', 'tassak', 'daşşak',
  'kahpe', 'kaltak', 'sürtük', 'surtuk',
  'gavat', 'ibne', 'puşt', 'pust',
  'bok', 'boktan', 'haysiyetsiz',
  'gerizekalı', 'gerizekali', 'salak', 'aptal', 'mal',
  'ananı', 'anani', 'bacını', 'bacini',
  'döl', 'dol', 'meme', 'çük', 'cuk',
];

// İngilizce küfür
const EN_PROFANITY = [
  'fuck', 'shit', 'bitch', 'asshole', 'dick', 'cock',
  'pussy', 'cunt', 'whore', 'slut', 'bastard',
  'nigger', 'faggot', 'retard',
  'motherfucker', 'bullshit', 'goddamn',
  'wanker', 'twat', 'prick',
];

// Tüm kelimelerden regex oluştur
// \b Türkçe karakterlerle çalışmıyor, bu yüzden (?:^|\\s|[.,!?]) kullanıyoruz
const allWords = [...TR_PROFANITY, ...EN_PROFANITY].join('|');
const profanityRegex = new RegExp(
  '(?:^|\\s|[.,!?])(' + allWords + ')(?:\\s|[.,!?]|$)',
  'i'
);

// İletişim bilgisi paylaşımı
const CONTACT_PATTERNS = [
  // Türk telefon numarası
  /(\+?90|0)[\s\-.]?\d{3}[\s\-.]?\d{3}[\s\-.]?\d{2}[\s\-.]?\d{2}/,
  // Genel telefon numarası (7+ ardışık rakam)
  /\d[\s\-.]?\d[\s\-.]?\d[\s\-.]?\d[\s\-.]?\d[\s\-.]?\d[\s\-.]?\d+/,
  // Email adresi
  /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/,
  // Sosyal medya handle'ları
  /(?:instagram|insta|snap(?:chat)?|telegram|whatsapp|wp|tiktok|twitter|x\.com)[\s:./]?\s*@?\w{3,}/i,
  // @ ile başlayan handle (tek başına)
  /@[a-zA-Z0-9_]{3,}/,
  // URL
  /https?:\/\/\S+/i,
  /www\.\S+/i,
];

// Spam kalıpları
const SPAM_PATTERNS = [
  /(.)\1{5,}/, // 6+ tekrarlanan karakter (aaaaaa, !!!!!!)
  /[A-ZÇĞİÖŞÜ\s]{20,}/, // 20+ büyük harf (BAĞIRMA)
];

// Taciz kalıpları
const HARASSMENT_PATTERNS = [
  /\böldür/i,
  /\bintihar/i,
  /\bkendini\s+öldür/i,
  /\bseni\s+bulurum/i,
  /\badresini\s+biliyorum/i,
  /\btehdit/i,
];

export function moderateText(text: string): ModerationResult {
  if (!text || typeof text !== 'string') return { clean: true };

  const normalized = text.toLowerCase().trim();

  // Küfür kontrolü
  if (profanityRegex.test(normalized)) {
    return { clean: false, reason: 'profanity' };
  }

  // Taciz kontrolü
  for (const pattern of HARASSMENT_PATTERNS) {
    if (pattern.test(normalized)) {
      return { clean: false, reason: 'harassment' };
    }
  }

  // İletişim bilgisi kontrolü
  for (const pattern of CONTACT_PATTERNS) {
    if (pattern.test(text)) {
      return { clean: false, reason: 'contact_info' };
    }
  }

  // Spam kontrolü
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(text)) {
      return { clean: false, reason: 'spam' };
    }
  }

  return { clean: true };
}

// Kullanıcıya gösterilecek uyarı mesajları (i18n key'leri)
export function getModerationMessage(reason: string): string {
  switch (reason) {
    case 'profanity':
      return 'moderation.profanity';
    case 'harassment':
      return 'moderation.harassment';
    case 'contact_info':
      return 'moderation.contactInfo';
    case 'spam':
      return 'moderation.spam';
    default:
      return 'moderation.generic';
  }
}
