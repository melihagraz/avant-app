import { moderateText, getModerationMessage } from '../../lib/moderation';

describe('moderateText', () => {
  // Clean text
  it('should pass clean text', () => {
    expect(moderateText('Merhaba, nasılsın?')).toEqual({ clean: true });
  });

  it('should pass empty/null text', () => {
    expect(moderateText('')).toEqual({ clean: true });
    expect(moderateText(null as any)).toEqual({ clean: true });
  });

  // Profanity
  it('should catch Turkish profanity', () => {
    const result = moderateText('sen gerizekalı mısın');
    expect(result.clean).toBe(false);
    expect(result.reason).toBe('profanity');
  });

  it('should catch English profanity', () => {
    const result = moderateText('what the fuck');
    expect(result.clean).toBe(false);
    expect(result.reason).toBe('profanity');
  });

  it('should catch case-insensitive profanity', () => {
    const result = moderateText('SALAK misin');
    expect(result.clean).toBe(false);
    expect(result.reason).toBe('profanity');
  });

  // Contact info
  it('should catch Turkish phone numbers', () => {
    const result = moderateText('numaramı ver 0532 123 45 67');
    expect(result.clean).toBe(false);
    expect(result.reason).toBe('contact_info');
  });

  it('should catch email addresses', () => {
    const result = moderateText('bana yaz test@gmail.com');
    expect(result.clean).toBe(false);
    expect(result.reason).toBe('contact_info');
  });

  it('should catch instagram handles', () => {
    const result = moderateText('instagram: @username123');
    expect(result.clean).toBe(false);
    expect(result.reason).toBe('contact_info');
  });

  it('should catch URLs', () => {
    const result = moderateText('bak https://example.com');
    expect(result.clean).toBe(false);
    expect(result.reason).toBe('contact_info');
  });

  // Spam
  it('should catch repeated characters', () => {
    const result = moderateText('aaaaaaaaa');
    expect(result.clean).toBe(false);
    expect(result.reason).toBe('spam');
  });

  it('should catch excessive caps', () => {
    const result = moderateText('BU MESAJ TAMAMEN BUYUK HARFLERLE YAZILMIS');
    expect(result.clean).toBe(false);
    expect(result.reason).toBe('spam');
  });

  // Harassment
  it('should catch threats', () => {
    const result = moderateText('seni bulurum bekle');
    expect(result.clean).toBe(false);
    expect(result.reason).toBe('harassment');
  });

  // Edge cases
  it('should allow normal Turkish text', () => {
    expect(moderateText('Bugün hava çok güzel').clean).toBe(true);
  });

  it('should allow numbers in context', () => {
    expect(moderateText('25 yaşındayım').clean).toBe(true);
  });
});

describe('getModerationMessage', () => {
  it('should return correct i18n key for profanity', () => {
    expect(getModerationMessage('profanity')).toBe('moderation.profanity');
  });

  it('should return correct i18n key for contact_info', () => {
    expect(getModerationMessage('contact_info')).toBe('moderation.contactInfo');
  });

  it('should return generic for unknown reason', () => {
    expect(getModerationMessage('unknown')).toBe('moderation.generic');
  });
});
